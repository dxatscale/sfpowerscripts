import DeploymentExecutor, { DeploySourceResult, DeploymentType } from '../../deployers/DeploymentExecutor';
import ReconcileProfileAgainstOrgImpl from '../../sfpowerkitwrappers/ReconcileProfileAgainstOrgImpl';
import DeployDestructiveManifestToOrgImpl from '../../sfpowerkitwrappers/DeployDestructiveManifestToOrgImpl';
import PackageMetadata from '../../PackageMetadata';
import OrgDetailsFetcher, { OrgDetails } from '../../org/OrgDetailsFetcher';
import SFPLogger, { COLOR_SUCCESS, COLOR_WARNING, Logger, LoggerLevel } from '../../logger/SFPLogger';
import * as fs from 'fs-extra';
const path = require('path');
const glob = require('glob');
const { EOL } = require('os');
const tmp = require('tmp');
import { InstallPackage } from './InstallPackage';
import PackageManifest from '../PackageManifest';
import PushSourceToOrgImpl from '../../deployers/PushSourceToOrgImpl';
import DeploySourceToOrgImpl, { DeploymentOptions } from '../../deployers/DeploySourceToOrgImpl';
import PackageEmptyChecker from '../PackageEmptyChecker';
import { TestLevel } from '../../apextest/TestOptions';

export default class InstallSourcePackageImpl extends InstallPackage {
    private options: any;
    private pathToReplacementForceIgnore: string;
    private deploymentType: DeploymentType;

    private isDiffFolderAvailable;

    public constructor(
        sfdxPackage: string,
        targetusername: string,
        sourceDirectory: string,
        options: any,
        skipIfPackageInstalled: boolean,
        packageMetadata: PackageMetadata,
        logger: Logger,
        pathToReplacementForceIgnore: string,
        deploymentType: DeploymentType,
        isDryRun: boolean
    ) {
        super(sfdxPackage, targetusername, sourceDirectory, packageMetadata, skipIfPackageInstalled, logger, isDryRun);
        this.options = options;
        this.pathToReplacementForceIgnore = pathToReplacementForceIgnore;
        this.deploymentType = deploymentType;
        this.isDiffFolderAvailable =  deploymentType === DeploymentType.SELECTIVE_MDAPI_DEPLOY &&
        fs.existsSync(path.join(this.sourceDirectory, 'diff'));
    }

    public async install() {
        let tmpDirObj = tmp.dirSync({ unsafeCleanup: true });
        let tempDir = tmpDirObj.name;

        try {
            this.packageMetadata.isTriggerAllTests = this.isAllTestsToBeTriggered(this.packageMetadata);

            this.handleForceIgnores();

            // Apply Destructive Manifest
            if (this.packageMetadata.destructiveChanges) {
                await this.applyDestructiveChanges();
            }

            //Apply Reconcile if Profiles are found
            //To Reconcile we have to go for multiple deploys, first we have to reconcile profiles and deploy the metadata
            let isReconcileActivated = false,
                isReconcileErrored = false;
            let profileFolders;
            if (this.packageMetadata.isProfilesFound && this.packageMetadata.reconcileProfiles !== false) {
                ({
                    profileFolders,
                    isReconcileActivated,
                    isReconcileErrored,
                } = await this.reconcileProfilesBeforeDeployment(
                    profileFolders,
                    this.sourceDirectory,
                    this.targetusername,
                    tempDir
                ));

                //Reconcile Failed, Bring back the original profiles
                if (isReconcileErrored && profileFolders.length > 0) {
                    SFPLogger.log('Restoring original profiles as preprocessing failed', LoggerLevel.INFO, this.logger);
                    profileFolders.forEach((folder) => {
                        fs.copySync(path.join(tempDir, folder), path.join(this.sourceDirectory, folder));
                    });
                }
            }

            let deploymentOptions: DeploymentOptions;

            let result: DeploySourceResult;
            if (this.deploymentType === DeploymentType.SOURCE_PUSH) {
                let pushSourceToOrgImpl: DeploymentExecutor = new PushSourceToOrgImpl(
                    this.targetusername,
                    this.sourceDirectory,
                    this.packageDirectory,
                    this.logger
                );

                result = await pushSourceToOrgImpl.exec();
            } else {
                //Construct Deploy Command for actual payload
                deploymentOptions = await this.generateDeploymentOptions(
                    this.options.waitTime,
                    this.options.optimizeDeployment,
                    this.options.skipTesting,
                    this.targetusername,
                    this.options.apiVersion
                );

                //Make a copy.. dont mutate sourceDirectory
                let resolvedSourceDirectory = this.sourceDirectory;

                if (this.isDiffFolderAvailable) {
                    SFPLogger.log(
                        `${COLOR_SUCCESS(`Selective mode activated, Only changed components in package is deployed`)}`,
                        LoggerLevel.INFO,
                        this.logger
                    );
                    resolvedSourceDirectory = path.join(this.sourceDirectory, 'diff');
                }

                let emptyCheck = this.handleEmptyPackage(resolvedSourceDirectory, this.packageDirectory);

                if (emptyCheck.isToSkip == true) {
                    SFPLogger.log(
                        `${COLOR_SUCCESS(`Skipping the package as there is nothing to be deployed`)}`,
                        LoggerLevel.INFO,
                        this.logger
                    );
                    return;
                } else if (emptyCheck.isToSkip == false) {
                    //Display a warning
                    if (
                        this.deploymentType == DeploymentType.SELECTIVE_MDAPI_DEPLOY &&
                        resolvedSourceDirectory != emptyCheck.resolvedSourceDirectory
                    ) {
                        SFPLogger.log(
                            `${COLOR_WARNING(
                                `Overriding selective mode to full deployment mode as selective component calculation was not successful`
                            )}`,
                            LoggerLevel.INFO,
                            this.logger
                        );
                    }

                    let deploySourceToOrgImpl: DeploymentExecutor = new DeploySourceToOrgImpl(
                        this.org,
                        emptyCheck.resolvedSourceDirectory,
                        this.packageDirectory,
                        deploymentOptions,
                        false,
                        this.logger
                    );

                    result = await deploySourceToOrgImpl.exec();

                    if (result.result) {
                        //Apply PostDeployment Activities
                        try {
                            if (isReconcileActivated) {
                                //Bring back the original profiles, reconcile and redeploy again
                                await this.reconcileAndRedeployProfiles(
                                    profileFolders,
                                    this.sourceDirectory,
                                    this.targetusername,
                                    this.packageDirectory,
                                    tempDir,
                                    deploymentOptions
                                );
                            }
                        } catch (error) {
                            SFPLogger.log(
                                'Failed to apply reconcile the second time, Partial Metadata applied',
                                LoggerLevel.INFO,
                                this.logger
                            );
                        }
                    } else if (result.result === false) {
                        throw new Error(result.message);
                    }
                }
            }
        } catch (error) {
            tmpDirObj.removeCallback();
            throw error;
        }
    }

    private handleEmptyPackage(
        sourceDirectory: string,
        packageDirectory: string
    ): { isToSkip: boolean; resolvedSourceDirectory: string } {
        //Check empty conditions
        let status = PackageEmptyChecker.isToBreakBuildForEmptyDirectory(sourceDirectory, packageDirectory, false);

        //On a diff deployment, we might need to deploy full as version changed or scratch org config has changed
        //In that case lets check again with the main directory and proceed ahead with deployment
        if (
          this.deploymentType == DeploymentType.SELECTIVE_MDAPI_DEPLOY &&
            status.result == 'skip'
        ) {
            sourceDirectory = sourceDirectory.substring(0, this.sourceDirectory.indexOf('/diff'));
            //Check empty conditions
            status = PackageEmptyChecker.isToBreakBuildForEmptyDirectory(sourceDirectory, packageDirectory, false);
        }

        if (status.result == 'break') {
            throw new Error('No compoments in the package, Please check your build again');
        } else if (status.result == 'skip') {
            return {
                isToSkip: true,
                resolvedSourceDirectory: sourceDirectory,
            };
        } else {
            return {
                isToSkip: false,
                resolvedSourceDirectory: sourceDirectory,
            };
        }
    }

    private handleForceIgnores() {
        if (this.pathToReplacementForceIgnore) {
            this.replaceForceIgnoreInSourceDirectory(this.sourceDirectory, this.pathToReplacementForceIgnore);

            //Handle Diff condition
            if (this.isDiffFolderAvailable)
                this.replaceForceIgnoreInSourceDirectory(
                    path.join(this.sourceDirectory, 'diff'),
                    this.pathToReplacementForceIgnore
                );
        }
    }

    private async applyDestructiveChanges() {
        try {
            SFPLogger.log(
                'Attempt to delete components mentioned in destructive manifest',
                LoggerLevel.INFO,
                this.logger
            );
            let deployDestructiveManifestToOrg = new DeployDestructiveManifestToOrgImpl(
                this.targetusername,
                path.join(this.sourceDirectory, 'destructive', 'destructiveChanges.xml')
            );

            await deployDestructiveManifestToOrg.exec();
        } catch (error) {
            SFPLogger.log(
                'We attempted a deletion of components, However were are not succesfull. Either the components are already deleted or there are components which have dependency to components in the manifest, Please check whether this manifest works!',
                LoggerLevel.INFO,
                this.logger
            );
        }
    }

    private isAllTestsToBeTriggered(packageMetadata: PackageMetadata) {
        if (packageMetadata.package_type == 'delta') {
            SFPLogger.log(
                ` ----------------------------------WARNING!  NON OPTIMAL DEPLOYMENT---------------------------------------------${EOL}` +
                    `This package has apex classes/triggers, In order to deploy optimally, each class need to have a minimum ${EOL}` +
                    `75% test coverage, However being a dynamically generated delta package, we will deploying via triggering all local tests${EOL}` +
                    `This definitely is not optimal approach on large orgs, You might want to start splitting into smaller source/unlocked packages  ${EOL}` +
                    `-------------------------------------------------------------------------------------------------------------`,
                LoggerLevel.INFO,
                this.logger
            );
            return true;
        } else if (
            this.packageMetadata.package_type == 'source' &&
            this.packageMetadata.isApexFound == true &&
            this.packageMetadata.apexTestClassses == null
        ) {
            SFPLogger.log(
                ` ----------------------------------WARNING!  NON OPTIMAL DEPLOYMENT--------------------------------------------${EOL}` +
                    `This package has apex classes/triggers, In order to deploy optimally, each class need to have a minimum ${EOL}` +
                    `75% test coverage,We are unable to find any test classes in the given package, hence will be deploying ${EOL}` +
                    `via triggering all local tests,This definitely is not optimal approach on large orgs` +
                    `Please consider adding test classes for the classes in the package ${EOL}` +
                    `-------------------------------------------------------------------------------------------------------------`,
                LoggerLevel.INFO,
                this.logger
            );
            return true;
        } else return false;
    }

    private async reconcileProfilesBeforeDeployment(
        profileFolders: any,
        sourceDirectoryPath: string,
        target_org: string,
        tempDir: string
    ) {
        let isReconcileActivated: boolean = false;
        let isReconcileErrored: boolean = false;
        try {
            SFPLogger.log('Attempting reconcile to profiles', LoggerLevel.INFO, this.logger);
            //copy the original profiles to temporary location
            profileFolders = glob.sync('**/profiles', {
                cwd: path.join(sourceDirectoryPath),
            });
            if (profileFolders.length > 0) {
                profileFolders.forEach((folder) => {
                    fs.copySync(path.join(sourceDirectoryPath, folder), path.join(tempDir, folder));
                });
            }
            //Now Reconcile
            let reconcileProfileAgainstOrg: ReconcileProfileAgainstOrgImpl = new ReconcileProfileAgainstOrgImpl(
                target_org,
                path.join(sourceDirectoryPath),
                this.logger
            );
            await reconcileProfileAgainstOrg.exec();
            isReconcileActivated = true;
        } catch (err) {
            SFPLogger.log('Failed to reconcile profiles:' + err, LoggerLevel.INFO, this.logger);
            isReconcileErrored = true;
        }
        return { profileFolders, isReconcileActivated, isReconcileErrored };
    }

    private async reconcileAndRedeployProfiles(
        profileFolders: string[],
        sourceDirectoryPath: string,
        target_org: string,
        sourceDirectory: string,
        tmpdir: string,
        deploymentOptions: any
    ) {
        //if no profile supported metadata, no point in
        //doing a reconcile
        let packageManifest = await PackageManifest.createWithJSONManifest(this.packageMetadata.payload);
        if (!packageManifest.isPayLoadContainTypesSupportedByProfiles()) return;

        if (profileFolders.length > 0) {
            profileFolders.forEach((folder) => {
                fs.copySync(path.join(tmpdir, folder), path.join(sourceDirectoryPath, folder));
            });

            //Now Reconcile
            let reconcileProfileAgainstOrg: ReconcileProfileAgainstOrgImpl = new ReconcileProfileAgainstOrgImpl(
                target_org,
                path.join(sourceDirectoryPath),
                this.logger
            );
            await reconcileProfileAgainstOrg.exec();

            //Now deploy the profies alone

            const profilesDirs = glob.sync('**/profiles/', {
                cwd: path.join(sourceDirectoryPath, sourceDirectory),
                absolute: true,
            });

            const profileDeploymentStagingDirectory = path.join(
                sourceDirectoryPath,
                'ProfileDeploymentStagingDirectory'
            );
            fs.mkdirpSync(path.join(profileDeploymentStagingDirectory, sourceDirectory, 'profiles'));

            for (const dir of profilesDirs) {
                // Duplicate profiles are overwritten
                fs.copySync(dir, path.join(profileDeploymentStagingDirectory, sourceDirectory, 'profiles'));
            }

            fs.copySync(
                path.join(sourceDirectoryPath, 'sfdx-project.json'),
                path.join(profileDeploymentStagingDirectory, 'sfdx-project.json')
            );
            fs.copySync(
                path.join(sourceDirectoryPath, '.forceignore'),
                path.join(profileDeploymentStagingDirectory, '.forceignore')
            );

            let deploySourceToOrgImpl: DeploySourceToOrgImpl = new DeploySourceToOrgImpl(
                this.org,
                profileDeploymentStagingDirectory,
                sourceDirectory,
                deploymentOptions,
                false,
                this.logger
            );
            let profileReconcile: DeploySourceResult = await deploySourceToOrgImpl.exec();

            if (!profileReconcile.result) {
                SFPLogger.log('Unable to deploy reconciled  profiles', LoggerLevel.INFO, this.logger);
            }
        }
    }

    private async generateDeploymentOptions(
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

        if (skipTest) {
            let orgDetails: OrgDetails;
            try {
                orgDetails = await new OrgDetailsFetcher(target_org).getOrgDetails();
            } catch (err) {
                SFPLogger.log(
                    ` -------------------------WARNING! SKIPPING TESTS AS ORG TYPE CANNOT BE DETERMINED! ------------------------------------${EOL}` +
                        `Tests are mandatory for deployments to production and cannot be skipped. This deployment might fail as org${EOL}` +
                        `type cannot be determined` +
                        `-------------------------------------------------------------------------------------------------------------${EOL}`,
                    LoggerLevel.WARN,
                    this.logger
                );

                deploymentOptions.testLevel = TestLevel.RunNoTests;
                return deploymentOptions;
            }

            /* TODO: This should only be displayed during normal installation and not validate, as tests are skipped always
              For addressing this, install source needs context on which stage package is installed
              which we do not have here, hence changing this loglevel to DEBUG For now, */
            if (orgDetails && orgDetails.isSandbox) {
                SFPLogger.log(
                    ` --------------------------------------WARNING! SKIPPING TESTS-------------------------------------------------${EOL}` +
                        `Skipping tests for deployment to sandbox. Be cautious that deployments to prod will require tests and >75% code coverage ${EOL}` +
                        `-------------------------------------------------------------------------------------------------------------`,
                    LoggerLevel.DEBUG,
                    this.logger
                );
                deploymentOptions.testLevel = TestLevel.RunNoTests;
            } else {
                SFPLogger.log(
                    ` -------------------------WARNING! TESTS ARE MANDATORY FOR PROD DEPLOYMENTS------------------------------------${EOL}` +
                        `Tests are mandatory for deployments to production and cannot be skipped. Running all local tests! ${EOL}` +
                        `-------------------------------------------------------------------------------------------------------------`,
                    LoggerLevel.WARN,
                    this.logger
                );
                deploymentOptions.testLevel = TestLevel.RunNoTests;
            }
        } else if (this.packageMetadata.isApexFound) {
            if (this.packageMetadata.isTriggerAllTests) {
                deploymentOptions.testLevel = TestLevel.RunAllTestsInPackage;
            } else if (this.packageMetadata.apexTestClassses?.length > 0 && optimizeDeployment) {
                deploymentOptions.testLevel = TestLevel.RunSpecifiedTests;
                deploymentOptions.specifiedTests = this.getAStringOfSpecificTestClasses(
                    this.packageMetadata.apexTestClassses
                );
            } else {
                deploymentOptions.testLevel = TestLevel.RunLocalTests;
            }
        } else {
            deploymentOptions.testLevel = TestLevel.RunSpecifiedTests;
            deploymentOptions.specifiedTests = 'skip';
        }
        return deploymentOptions;
    }

    private getAStringOfSpecificTestClasses(apexTestClassses: string[]) {
        let specifedTests = apexTestClassses.join();
        return specifedTests;
    }

    /**
     * Replaces forceignore in source directory with provided forceignore
     * @param sourceDirectory
     * @param pathToReplacementForceIgnore
     */
    private replaceForceIgnoreInSourceDirectory(sourceDirectory: string, pathToReplacementForceIgnore: string): void {
        if (fs.existsSync(pathToReplacementForceIgnore))
            fs.copySync(pathToReplacementForceIgnore, path.join(sourceDirectory, '.forceignore'));
        else {
            SFPLogger.log(`${pathToReplacementForceIgnore} does not exist`, LoggerLevel.INFO, this.logger);
            SFPLogger.log(
                'Package installation will continue using the unchanged forceignore in the source directory',
                null,
                this.logger
            );
        }
    }
}
