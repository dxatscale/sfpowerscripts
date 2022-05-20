import SFPLogger, { Logger, LoggerLevel } from '../../logger/SFPLogger';
import { PackageInstallationResult, PackageInstallationStatus } from './PackageInstallationResult';
import ProjectConfig from '../../project/ProjectConfig';
import SFPStatsSender from '../../stats/SFPStatsSender';
import PackageInstallationHelpers from './PackageInstallationHelpers';
import { Connection } from '@salesforce/core';
import * as fs from 'fs-extra';
import FileSystem from '../../utils/FileSystem';
import OrgDetailsFetcher from '../../org/OrgDetailsFetcher';
import path = require('path');
import PermissionSetGroupUpdateAwaiter from '../../permsets/PermissionSetGroupUpdateAwaiter';
import SfpOrg from '../../org/SFPOrg';
import SfpPackage from '../SfpPackage';
import { DeploymentType } from '../../deployers/DeploymentExecutor';

export class SfpPackageInstallationOptions {
    installationkey?: string;
    apexcompile?: string = 'package';
    securitytype?: string = 'AdminsOnly';
    upgradetype?: string = 'Mixed';
    waitTime?: string;
    apiVersion?: string;
    publishWaitTime?: number = 60;
    skipTesting?: boolean;
    optimizeDeployment?: boolean;
    deploymentType?: DeploymentType;
    disableArtifactCommit?: boolean=false;
    isInstallingForValidation?: boolean;
    skipIfPackageInstalled: boolean;
    isDryRun?: boolean=false;
    pathToReplacementForceIgnore?: string;
}


export abstract class InstallPackage {
    private startTime: number;
    protected connection: Connection;
    protected packageDescriptor;
    protected packageDirectory;

    private _isArtifactToBeCommittedInOrg: boolean = true;

    public constructor(
        protected sfpPackage: SfpPackage,
        protected sfpOrg:SfpOrg,
        protected logger: Logger,
        protected options: SfpPackageInstallationOptions
    ) {}

    public async exec(): Promise<PackageInstallationResult> {
        try {
            this.startTime = Date.now();

            this.packageDescriptor = ProjectConfig.getSFDXPackageDescriptor(
                this.sfpPackage.sourceDir,
                this.sfpPackage.packageName
            );

           
           
            this.connection = this.sfpOrg.getConnection();

            if (await this.isPackageToBeInstalled(this.options.skipIfPackageInstalled)) {
                if (!this.options.isDryRun) {
                    //Package Has Permission Set Group
                    if (this.sfpPackage.isPermissionSetGroupFound) await this.waitTillAllPermissionSetGroupIsUpdated();
                    await this.preInstall();
                    await this.getPackageDirectoryForAliasifiedPackages();
                    await this.install();
                    await this.postInstall();
                    await this.commitPackageInstallationStatus();
                    this.sendMetricsWhenSuccessfullyInstalled();
                }
                return { result: PackageInstallationStatus.Succeeded };
            } else {
                SFPLogger.log('Skipping Package Installation', LoggerLevel.INFO, this.logger);
                return { result: PackageInstallationStatus.Skipped };
            }
        } catch (error) {
            this.sendMetricsWhenFailed();
            return {
                result: PackageInstallationStatus.Failed,
                message: error.message,
            };
        }
    }

    private async waitTillAllPermissionSetGroupIsUpdated() {
        let permissionSetGroupUpdateAwaiter: PermissionSetGroupUpdateAwaiter = new PermissionSetGroupUpdateAwaiter(
            this.connection,
            this.logger
        );
        await permissionSetGroupUpdateAwaiter.waitTillAllPermissionSetGroupIsUpdated();
    }

    protected async getPackageDirectoryForAliasifiedPackages() {
        if (this.packageDescriptor.aliasfy) {
            const searchDirectory = path.join(this.sfpPackage.sourceDir, this.packageDescriptor.path);
            const files = FileSystem.readdirRecursive(searchDirectory, true);

            let aliasDir: string;

            let alias = await this.sfpOrg.getAlias();
            aliasDir = files.find(
                (file) =>
                    path.basename(file) === alias &&
                    fs.lstatSync(path.join(searchDirectory, file)).isDirectory()
            );

            SFPLogger.log(`Using alias directory ${aliasDir?aliasDir:'default'}`,LoggerLevel.INFO,this.logger);

            if (!aliasDir) {
                const orgDetails = await new OrgDetailsFetcher(this.sfpOrg.getUsername()).getOrgDetails();

                if (orgDetails.isSandbox) {
                    // If the target org is a sandbox, find a 'default' directory to use as package directory
                    aliasDir = files.find(
                        (file) =>
                            path.basename(file) === 'default' &&
                            fs.lstatSync(path.join(searchDirectory, file)).isDirectory()
                    );
                }
            }

            if (!aliasDir) {
                throw new Error(
                    `Aliasfied package '${this.sfpPackage.packageName}' does not have an alias with '${alias}'' or 'default' directory`
                );
            }

            this.packageDirectory = path.join(this.packageDescriptor.path, aliasDir);
        } else {
            this.packageDirectory = path.join(this.packageDescriptor['path']);
        }

        let absPackageDirectory: string = path.join(this.sfpPackage.sourceDir, this.packageDirectory);
        if (!fs.existsSync(absPackageDirectory)) {
            throw new Error(`Package directory ${absPackageDirectory} does not exist`);
        }
    }

    private sendMetricsWhenFailed() {
        SFPStatsSender.logCount('package.installation.failure', {
            package: this.sfpPackage.package_name,
            type: this.sfpPackage.package_type,
            target_org: this.sfpOrg.getUsername(),
        });
    }

    private sendMetricsWhenSuccessfullyInstalled() {
        let elapsedTime = Date.now() - this.startTime;
        SFPStatsSender.logElapsedTime('package.installation.elapsed_time', elapsedTime, {
            package: this.sfpPackage.package_name,
            type: this.sfpPackage.package_type,
            target_org: this.sfpOrg.getUsername(),
        });
        SFPStatsSender.logCount('package.installation', {
            package: this.sfpPackage.package_name,
            type: this.sfpPackage.package_type,
            target_org: this.sfpOrg.getUsername(),
        });
    }

    //Set this to disable whethere info about the artifact has to be recorded in the org
    public set isArtifactToBeCommittedInOrg(toCommit: boolean) {
        this._isArtifactToBeCommittedInOrg = toCommit;
    }

    private async commitPackageInstallationStatus() {
        if (this._isArtifactToBeCommittedInOrg) {
            try {
                await this.sfpOrg.updateArtifactInOrg(this.logger, this.sfpPackage);
            } catch (error) {
                SFPLogger.log(
                    'Unable to commit information about the package into org..Check whether prerequisities are installed',
                    LoggerLevel.WARN,
                    this.logger
                );
            }
        }
    }

    protected async isPackageToBeInstalled(skipIfPackageInstalled: boolean): Promise<boolean> {
        if (skipIfPackageInstalled) {
            let installationStatus = await this.sfpOrg.isArtifactInstalledInOrg(this.logger, this.sfpPackage);
            return !installationStatus.isInstalled;
        } else return true; // Always install packages if skipIfPackageInstalled is false
    }

    public async preInstall() {
        let preDeploymentScript: string = path.join(this.sfpPackage.sourceDir, `scripts`, `preDeployment`);

        if (this.sfpPackage.assignPermSetsPreDeployment) {
            SFPLogger.log('Assigning permission sets before deployment:', LoggerLevel.INFO, this.logger);

            await PackageInstallationHelpers.applyPermsets(
                this.sfpPackage.assignPermSetsPreDeployment,
                this.connection,
                this.sfpPackage.sourceDir,
                this.logger
            );
        }

        if (fs.existsSync(preDeploymentScript)) {
            SFPLogger.log('Executing preDeployment script');
            await PackageInstallationHelpers.executeScript(
                preDeploymentScript,
                this.sfpPackage.packageName,
                this.sfpOrg.getUsername(),
                this.logger
            );
        }
    }

    abstract install();

    public async postInstall() {
        let postDeploymentScript: string = path.join(this.sfpPackage.sourceDir, `scripts`, `postDeployment`);

        if (this.sfpPackage.assignPermSetsPostDeployment) {
            SFPLogger.log('Assigning permission sets after deployment:', LoggerLevel.INFO, this.logger);

            await PackageInstallationHelpers.applyPermsets(
                this.sfpPackage.assignPermSetsPostDeployment,
                this.connection,
                this.sfpPackage.sourceDir,
                this.logger
            );
        }

        if (fs.existsSync(postDeploymentScript)) {
            SFPLogger.log('Executing postDeployment script');
            await PackageInstallationHelpers.executeScript(
                postDeploymentScript,
                this.sfpPackage.packageName,
                this.sfpOrg.getUsername(),
                this.logger
            );
        }
    }
}

