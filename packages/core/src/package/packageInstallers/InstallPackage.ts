import SFPLogger, { COLOR_KEY_MESSAGE, Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { PackageInstallationResult, PackageInstallationStatus } from './PackageInstallationResult';
import ProjectConfig from '../../project/ProjectConfig';
import SFPStatsSender from '../../stats/SFPStatsSender';
import AssignPermissionSets from '../../permsets/AssignPermissionSets';
import ScriptExecutor from '../../scriptExecutor/ScriptExecutorHelpers';
import { Connection } from '@salesforce/core';
import * as fs from 'fs-extra';
import FileSystem from '../../utils/FileSystem';
import OrgDetailsFetcher, { OrgDetails } from '../../org/OrgDetailsFetcher';
import path = require('path');
import PermissionSetGroupUpdateAwaiter from '../../permsets/PermissionSetGroupUpdateAwaiter';
import SfpOrg from '../../org/SFPOrg';
import SfpPackage, { PackageType } from '../SfpPackage';
import DeploymentExecutor, { DeploySourceResult, DeploymentType } from '../../deployers/DeploymentExecutor';
import DeploySourceToOrgImpl, { DeploymentOptions } from '../../deployers/DeploySourceToOrgImpl';
import getFormattedTime from '../../utils/GetFormattedTime';
import { TestLevel } from '../../apextest/TestOptions';
import { PostDeployersRegistry } from '../deploymentCustomizers/PostDeployersRegistry';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import PackageComponentPrinter from '../../display/PackageComponentPrinter';
import DeployErrorDisplayer from '../../display/DeployErrorDisplayer';
import { PreDeployersRegistry } from '../deploymentCustomizers/PreDeployersRegistry';
import { AnalyzerRegistry } from '../../package/analyser/AnalyzerRegistry';

export class SfpPackageInstallationOptions {
    installationkey?: string;
    apexcompile?: string = 'package';
    securitytype?: string = 'none';
    upgradetype?: string = 'mixed-mode';
    waitTime?: string;
    apiVersion?: string;
    publishWaitTime?: number = 60;
    skipTesting?: boolean;
    optimizeDeployment?: boolean;
    deploymentType?: DeploymentType;
    disableArtifactCommit?: boolean = false;
    isInstallingForValidation?: boolean;
    skipIfPackageInstalled: boolean;
    isDryRun?: boolean = false;
    pathToReplacementForceIgnore?: string;
}

export abstract class InstallPackage {
    protected connection: Connection;
    protected packageDescriptor;
    protected packageDirectory;

    private _isArtifactToBeCommittedInOrg: boolean = true;

    public constructor(
        protected sfpPackage: SfpPackage,
        protected sfpOrg: SfpOrg,
        protected logger: Logger,
        protected options: SfpPackageInstallationOptions
    ) { }

    public async exec(): Promise<PackageInstallationResult> {
        let startTime = Date.now();
        let elapsedTime: number;
        try {
            this.packageDescriptor = ProjectConfig.getSFDXPackageDescriptor(
                this.sfpPackage.sourceDir,
                this.sfpPackage.packageName
            );

            this.connection = this.sfpOrg.getConnection();

            if (await this.isPackageToBeInstalled(this.options.skipIfPackageInstalled)) {
                if (!this.options.isDryRun) {
                    await this.waitTillAllPermissionSetGroupIsUpdated();
                    await this.assignPermsetsPreDeployment();
                    await this.executePreDeploymentScripts();
                    await this.setPackageDirectoryForPackage();
                    await this.executePreDeployers();
                    await this.checkPackageDirectoryExists();
                    await this.install();
                    await this.assignPermsetsPostDeployment();
                    await this.executePostDeployers();
                    await this.executePostDeploymentScript();
                    await this.commitPackageInstallationStatus();

                    elapsedTime = Date.now() - startTime;
                    this.sendMetricsWhenSuccessfullyInstalled(elapsedTime);
                }
                return { result: PackageInstallationStatus.Succeeded, elapsedTime: elapsedTime };
            } else {
                SFPLogger.log('Skipping Package Installation', LoggerLevel.INFO, this.logger);
                return { result: PackageInstallationStatus.Skipped };
            }
        } catch (error) {
            elapsedTime = Date.now() - startTime;
            this.sendMetricsWhenFailed(elapsedTime);
            return {
                result: PackageInstallationStatus.Failed,
                message: error.message,
                elapsedTime: elapsedTime,
            };
        }
    }
    
    checkPackageDirectoryExists() {
        let absPackageDirectory: string = path.join(this.sfpPackage.sourceDir, this.packageDirectory);
        if (!fs.existsSync(absPackageDirectory)) {
            throw new Error(`Package directory ${absPackageDirectory} does not exist`);
        }
    }

    private async waitTillAllPermissionSetGroupIsUpdated() {
        try {
            //Package Has Permission Set Group
            let permissionSetGroupUpdateAwaiter: PermissionSetGroupUpdateAwaiter = new PermissionSetGroupUpdateAwaiter(
                this.connection,
                this.logger
            );
            await permissionSetGroupUpdateAwaiter.waitTillAllPermissionSetGroupIsUpdated();
        } catch (error) {
            //Ignore error
            // Lets try proceeding
            SFPLogger.log(
                `Unable to check the status of Permission Set Groups due to ${error}`,
                LoggerLevel.WARN,
                this.logger
            );
        }
    }

    protected async setPackageDirectoryForPackage() {
        if (this.packageDescriptor.aliasfy) {
            const searchDirectory = path.join(this.sfpPackage.sourceDir, this.packageDescriptor.path);
            const files = FileSystem.readdirRecursive(searchDirectory, true);

            let aliasDir: string;

            let alias = await this.sfpOrg.getAlias();
            aliasDir = files.find(
                (file) => path.basename(file) === alias && fs.lstatSync(path.join(searchDirectory, file)).isDirectory()
            );

            SFPLogger.log(`Using alias directory ${aliasDir ? aliasDir : 'default'}`, LoggerLevel.INFO, this.logger);

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
                    `Aliasfied package '${this.sfpPackage.packageName}' does not have an alias with '${alias}' or 'default' directory`
                );
            }

            this.packageDirectory = path.join(this.packageDescriptor.path, aliasDir);
        }
         else {
            this.packageDirectory = path.join(this.packageDescriptor['path']);
        }

    }

    private sendMetricsWhenFailed(elapsedTime: number) {
        SFPLogger.log(
            `Package ${COLOR_KEY_MESSAGE(
                this.sfpPackage.package_name
            )} installation attempt failed,it took ${COLOR_KEY_MESSAGE(getFormattedTime(elapsedTime))}`
        );
        SFPStatsSender.logCount('package.installation.failure', {
            package: this.sfpPackage.package_name,
            type: this.sfpPackage.package_type,
            target_org: this.sfpOrg.getUsername(),
        });
    }

    private sendMetricsWhenSuccessfullyInstalled(elapsedTime: number) {
        SFPLogger.log(
            `Package ${COLOR_KEY_MESSAGE(this.sfpPackage.package_name)} installation took ${COLOR_KEY_MESSAGE(
                getFormattedTime(elapsedTime)
            )}`,
            LoggerLevel.INFO,
            this.logger
        );
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
        } else if(this.sfpPackage.packageType == PackageType.Diff) 
        {
          // If diff package, check if there are any changes to be deployed, else skip
           if(!this.sfpPackage.destructiveChanges && this.sfpPackage.metadataCount==0)
           { 
            return false;
           }
        }
        
         return true; // Always install packages if skipIfPackageInstalled is false
    }

    private async assignPermsetsPreDeployment() {
        try {
            if (this.sfpPackage.assignPermSetsPreDeployment) {
                SFPLogger.log('Assigning permission sets before deployment:', LoggerLevel.INFO, this.logger);

                await AssignPermissionSets.applyPermsets(
                    this.sfpPackage.assignPermSetsPreDeployment,
                    this.connection,
                    this.sfpPackage.sourceDir,
                    this.logger
                );
            }
        } catch (error) {
            //Proceed ahead not a critical error to break installation
            SFPLogger.log(`Unable to assign permsets (Pre Deployment) due to ${error}`, LoggerLevel.WARN, this.logger);
        }
    }

    public async executePreDeploymentScripts() {
        let preDeploymentScript: string = path.join(this.sfpPackage.sourceDir, `scripts`, `preDeployment`);
        if (fs.existsSync(preDeploymentScript)) {
            let alias = await this.sfpOrg.getAlias();
            SFPLogger.log('Executing preDeployment script', LoggerLevel.INFO, this.logger);
            await ScriptExecutor.executeScript(
                this.logger,
                preDeploymentScript,
                this.sfpPackage.packageName,
                this.sfpOrg.getUsername(),
                alias ? alias : this.sfpOrg.getUsername(),
                this.sfpPackage.sourceDir,
                this.sfpPackage.packageDirectory
            );
        }
    }

    abstract install();

    private async assignPermsetsPostDeployment() {
        try {
            if (this.sfpPackage.assignPermSetsPostDeployment) {
                SFPLogger.log('Assigning permission sets after deployment:', LoggerLevel.INFO, this.logger);

                await AssignPermissionSets.applyPermsets(
                    this.sfpPackage.assignPermSetsPostDeployment,
                    this.connection,
                    this.sfpPackage.sourceDir,
                    this.logger
                );
            }
        } catch (error) {
            //Proceed ahead not a critical error to break installation
            SFPLogger.log(`Unable to assign permsets (Post Deployment) due to ${error}`, LoggerLevel.WARN, this.logger);
        }
    }

    public async executePostDeploymentScript() {
        let postDeploymentScript: string = path.join(this.sfpPackage.sourceDir, `scripts`, `postDeployment`);
        if (fs.existsSync(postDeploymentScript)) {
            SFPLogger.log('Executing postDeployment script', LoggerLevel.INFO, this.logger);
            let alias = await this.sfpOrg.getAlias();
            await ScriptExecutor.executeScript(
                this.logger,
                postDeploymentScript,
                this.sfpPackage.packageName,
                this.sfpOrg.getUsername(),
                alias ? alias : this.sfpOrg.getUsername(),
                this.sfpPackage.sourceDir,
                this.sfpPackage.packageDirectory
            );
        }
    }

    private async executePostDeployers() {
        SFPLogger.log(`Executing Post Deployers`, LoggerLevel.INFO, this.logger);

        //Gather componentSet
        let componentSet = ComponentSet.fromSource(
            path.join(this.sfpPackage.projectDirectory, this.sfpPackage.packageDirectory)
        );

        for (const postDeployer of PostDeployersRegistry.getPostDeployers()) {
            try {
                if (await postDeployer.isEnabled(this.sfpPackage, this.connection, this.logger)) {
                    SFPLogger.log(
                        `Executing Pre Deployer ${COLOR_KEY_MESSAGE(postDeployer.getName())}`,
                        LoggerLevel.INFO,
                        this.logger
                    );

                    await postDeployer.execute(
                        this.sfpPackage,
                        componentSet,
                        this.sfpOrg,
                        this.logger,
                        {apiVersion:this.options.apiVersion,waitTime:this.options.waitTime}
                    );

                } else {
                    SFPLogger.log(
                        `Post Deployer ${COLOR_KEY_MESSAGE(postDeployer.getName())} skipped or not enabled`,
                        LoggerLevel.INFO,
                        this.logger
                    );
                }
            } catch (error) {
                SFPLogger.log(
                    `Unable to process post deploy for ${postDeployer.getName()} due to ${error.message}`,
                    LoggerLevel.WARN,
                    this.logger
                );
                SFPLogger.log(
                    `Pre Deployer ${COLOR_KEY_MESSAGE(postDeployer.getName())} skipped due to error`,
                    LoggerLevel.INFO,
                    this.logger
                );
            }
        }
    }

    private async executePreDeployers() {
        SFPLogger.log(`Executing Pre Deployers`, LoggerLevel.INFO, this.logger);

        //Gather componentSet
        let componentSet = ComponentSet.fromSource(
            path.join(this.sfpPackage.projectDirectory, this.sfpPackage.packageDirectory)
        );

        let analyzers = AnalyzerRegistry.getAnalyzers();
        for (const analyzer of analyzers) {
            if(await analyzer.isEnabled(this.sfpPackage, this.logger)) 
            {
              SFPLogger.log(`Executing ${COLOR_KEY_MESSAGE(analyzer.getName())}`, LoggerLevel.INFO, this.logger);
              this.sfpPackage = await analyzer.analyze(this.sfpPackage,componentSet, this.logger);
            }
            else
            {
                SFPLogger.log(`Skipped ${COLOR_KEY_MESSAGE(analyzer.getName())}`, LoggerLevel.INFO, this.logger);
            }
        }

        for (const preDeployer of PreDeployersRegistry.getPreDeployers()) {
            try {
                if (await preDeployer.isEnabled(this.sfpPackage, this.connection, this.logger)) {
                    SFPLogger.log(
                        `Executing Pre Deployer ${COLOR_KEY_MESSAGE(preDeployer.getName())}`,
                        LoggerLevel.INFO,
                        this.logger
                    );

                    await preDeployer.execute(
                        this.sfpPackage,
                        componentSet,
                        this.sfpOrg,
                        this.logger,
                        {apiVersion:this.options.apiVersion,waitTime:this.options.waitTime}
                    );

                } else {
                    SFPLogger.log(
                        `Pre Deployer ${COLOR_KEY_MESSAGE(preDeployer.getName())} skipped or not enabled`,
                        LoggerLevel.INFO,
                        this.logger
                    );
                }
            } catch (error) {
                SFPLogger.log(
                    `Unable to process pre deploy for ${preDeployer.getName()} due to ${error.message}`,
                    LoggerLevel.WARN,
                    this.logger
                );
                SFPLogger.log(
                    `Pre Deployer ${COLOR_KEY_MESSAGE(preDeployer.getName())} skipped due to error`,
                    LoggerLevel.INFO,
                    this.logger
                );
            }
        }
    }

    protected async generateDeploymentOptions(
        waitTime: string,
        optimizeDeployment: boolean,
        skipTest: boolean,
        target_org: string,
        apiVersion: string
    ): Promise<any> {
        let deploymentOptions: DeploymentOptions = {
            ignoreWarnings: true,
            waitTime: waitTime,
        };
        deploymentOptions.ignoreWarnings = true;
        deploymentOptions.waitTime = waitTime;
        deploymentOptions.apiVersion = apiVersion;

        //Find Org Type
        let orgDetails: OrgDetails;
        try {
            orgDetails = await new OrgDetailsFetcher(target_org).getOrgDetails();
        } catch (err) {
            SFPLogger.log(`Unable to fetch org details,assuming it is production`, LoggerLevel.WARN, this.logger);
            orgDetails = {
                instanceUrl: undefined,
                isScratchOrg: false,
                isSandbox: false,
                organizationType: undefined,
                sfdxAuthUrl: undefined,
                status: undefined,
            };
        }


       if (this.options.deploymentType == DeploymentType.MDAPI_DEPLOY && this.sfpPackage.isApexFound && this.options.isInstallingForValidation == false) {
            if (orgDetails.isSandbox) {
                //enforce during selective deployment
                if (skipTest) {
                    deploymentOptions.testLevel = TestLevel.RunNoTests;
                } else if (this.sfpPackage.apexTestClassses.length > 0 && optimizeDeployment) {
                    deploymentOptions.testLevel = TestLevel.RunSpecifiedTests;
                    deploymentOptions.specifiedTests = this.getAStringOfSpecificTestClasses(
                        this.sfpPackage.apexTestClassses
                    );
                } else {
                    deploymentOptions.testLevel = TestLevel.RunLocalTests;
                }
            } else {
                if (this.sfpPackage.apexTestClassses.length > 0 && optimizeDeployment) {
                    deploymentOptions.testLevel = TestLevel.RunSpecifiedTests;
                    deploymentOptions.specifiedTests = this.getAStringOfSpecificTestClasses(
                        this.sfpPackage.apexTestClassses
                    );
                } else {
                    deploymentOptions.testLevel = TestLevel.RunLocalTests;
                }
            }
        } else {
            if (orgDetails.isSandbox) {
                deploymentOptions.testLevel = TestLevel.RunNoTests;
            } else {
                deploymentOptions.testLevel = TestLevel.RunSpecifiedTests;
                deploymentOptions.specifiedTests = 'skip';
            }
        }

        deploymentOptions.rollBackOnError = true;
        return deploymentOptions;
    }
    
    private getAStringOfSpecificTestClasses(apexTestClassses: string[]) {
        let specifedTests = apexTestClassses.join();
        return specifedTests;
    }
}
