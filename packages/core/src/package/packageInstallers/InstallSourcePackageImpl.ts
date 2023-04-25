import DeploymentExecutor, { DeploySourceResult, DeploymentType } from '../../deployers/DeploymentExecutor';
import ReconcileProfileAgainstOrgImpl from '../../sfpowerkitwrappers/ReconcileProfileAgainstOrgImpl';
import DeployDestructiveManifestToOrgImpl from '../../sfpowerkitwrappers/DeployDestructiveManifestToOrgImpl';
import SFPLogger, { COLOR_SUCCESS, COLOR_WARNING, Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import * as fs from 'fs-extra';
const path = require('path');
const glob = require('glob');
const tmp = require('tmp');
import { InstallPackage, SfpPackageInstallationOptions } from './InstallPackage';
import DeploySourceToOrgImpl, { DeploymentOptions } from '../../deployers/DeploySourceToOrgImpl';
import PackageEmptyChecker from '../validators/PackageEmptyChecker';
import { TestLevel } from '../../apextest/TestOptions';
import SfpPackage from '../SfpPackage';
import SFPOrg from '../../org/SFPOrg';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import ProjectConfig from '../../project/ProjectConfig';
import { DeploymentFilterRegistry } from '../deploymentFilters/DeploymentFilterRegistry';
import DeploymentOptionDisplayer from '../../display/DeploymentOptionDisplayer';
import PackageComponentPrinter from '../../display/PackageComponentPrinter';
import DeployErrorDisplayer from '../../display/DeployErrorDisplayer';

export default class InstallSourcePackageImpl extends InstallPackage {
    private pathToReplacementForceIgnore: string;
    private deploymentType: DeploymentType;

    private isDiffFolderAvailable: boolean;

    public constructor(
        sfpPackage: SfpPackage,
        targetOrg: SFPOrg,
        options: SfpPackageInstallationOptions,
        logger: Logger
    ) {
        super(sfpPackage, targetOrg, logger, options);
        this.options = options;
        this.pathToReplacementForceIgnore = options.pathToReplacementForceIgnore;
        this.deploymentType = options.deploymentType;
        this.isDiffFolderAvailable =
            options.deploymentType === DeploymentType.SELECTIVE_MDAPI_DEPLOY &&
            fs.existsSync(path.join(this.sfpPackage.sourceDir, 'diff'));
    }

    public async install() {
        let tmpDirObj = tmp.dirSync({ unsafeCleanup: true });
        let tempDir = tmpDirObj.name;

        try {
            //Handle the right force ignore file
            this.handleForceIgnores();

            // Apply Destructive Manifest
            if (this.sfpPackage.destructiveChanges) {
                await this.applyDestructiveChanges();
            }

            //Apply Reconcile if Profiles are found
            //To Reconcile we have to go for multiple deploys, first we have to reconcile profiles and deploy the metadata
            let isReconcileActivated = false;
            let isReconcileErrored = false;
            let profileFolders;
            ({
                profileFolders,
                isReconcileActivated,
                isReconcileErrored,
            } = await this.reconcileProfilesBeforeDeployment(
                this.sfpPackage.sourceDir,
                this.sfpOrg.getUsername(),
                tempDir
            ));

            let deploymentOptions: DeploymentOptions;
            let result: DeploySourceResult;
            //Construct Deploy Command for actual payload
            deploymentOptions = await this.generateDeploymentOptions(
                this.options.waitTime,
                this.options.optimizeDeployment,
                this.options.skipTesting,
                this.sfpOrg.getUsername(),
                this.options.apiVersion
            );

            //enable source tracking
            if (this.deploymentType === DeploymentType.SOURCE_PUSH) {
                deploymentOptions.sourceTracking = true;
            }

            //Make a copy.. dont mutate sourceDirectory
            let resolvedSourceDirectory = this.sfpPackage.sourceDir;

            if (this.isDiffFolderAvailable) {
                SFPLogger.log(
                    `${COLOR_SUCCESS(`Selective mode activated, Only changed components in package is deployed`)}`,
                    LoggerLevel.INFO,
                    this.logger
                );
                resolvedSourceDirectory = path.join(this.sfpPackage.sourceDir, 'diff');
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

                //Create componentSet To Be Deployed
                let componentSet = ComponentSet.fromSource(
                    path.resolve(emptyCheck.resolvedSourceDirectory, this.packageDirectory)
                );

                //Apply Filters
                let deploymentFilters = DeploymentFilterRegistry.getImplementations();

                for (const deploymentFilter of deploymentFilters) {
                    if (
                        deploymentFilter.isToApply(
                            ProjectConfig.getSFDXProjectConfig(emptyCheck.resolvedSourceDirectory),
                            this.sfpPackage.packageType
                        )
                    )
                        componentSet = await deploymentFilter.apply(this.sfpOrg, componentSet, this.logger);
                }

                //Check if there are components to be deployed after filtering
                //Asssume its suscessfully deployed
                if (componentSet.size == 0) {
                    return {
                        deploy_id: `000000`,
                        result: true,
                        message: `Package contents were filtered out, nothing to install`,
                    };
                }

                //Print components inside Component Set
                let components =  componentSet.getSourceComponents();
                PackageComponentPrinter.printComponentTable(components, this.logger);
                                    

                if(!this.options.isInstallingForValidation)
                  DeploymentOptionDisplayer.printDeploymentOptions(deploymentOptions,this.logger);
                
                let deploySourceToOrgImpl: DeploymentExecutor = new DeploySourceToOrgImpl(
                    this.sfpOrg,
                    this.sfpPackage.sourceDir,
                    componentSet,
                    deploymentOptions,
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
                                this.sfpPackage.sourceDir,
                                this.sfpOrg.getUsername(),
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
                    DeployErrorDisplayer.displayErrors(result.response,this.logger);
                    throw new Error(result.message);
                }
            }
            //}
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
        if (this.deploymentType == DeploymentType.SELECTIVE_MDAPI_DEPLOY && status.result == 'skip') {
            sourceDirectory = sourceDirectory.substring(0, this.sfpPackage.sourceDir.indexOf('/diff'));
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
            this.replaceForceIgnoreInSourceDirectory(this.sfpPackage.sourceDir, this.pathToReplacementForceIgnore);

            //Handle Diff condition
            if (this.isDiffFolderAvailable)
                this.replaceForceIgnoreInSourceDirectory(
                    path.join(this.sfpPackage.sourceDir, 'diff'),
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
                this.sfpOrg.getUsername(),
                path.join(this.sfpPackage.sourceDir, 'destructive', 'destructiveChanges.xml')
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

    private async reconcileProfilesBeforeDeployment(sourceDirectoryPath: string, target_org: string, tempDir: string) {
        let profileFolders: any;
        let isReconcileActivated: boolean = false;
        let isReconcileErrored: boolean = false;
        try {
            //Hard exit.. no reconcile set in orchestrator
            if (this.sfpPackage.reconcileProfiles == false) return { isReconcileActivated: false };

            //Handle diff for fastfeedback
            if (this.sfpPackage.isProfilesFound) {
                if (this.isDiffFolderAvailable) {
                    if (this.sfpPackage.diffPackageMetadata?.isProfilesFound == false)
                        return { isReconcileActivated: false };
                    else {
                        sourceDirectoryPath = path.join(sourceDirectoryPath, 'diff');
                    }
                }
            } else {
                return { isReconcileActivated: false };
            }

            SFPLogger.log(
                'Attempting reconcile to profiles as payload contain profiles',
                LoggerLevel.INFO,
                this.logger
            );
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
            if (profileFolders.length > 0) {
                SFPLogger.log('Restoring original profiles as preprocessing failed', LoggerLevel.INFO, this.logger);
                profileFolders.forEach((folder) => {
                    fs.copySync(path.join(tempDir, folder), path.join(this.sfpPackage.sourceDir, folder));
                });
            }
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

        //Handle diff for fastfeedback
        if (this.isDiffFolderAvailable) {
            if (this.sfpPackage.diffPackageMetadata?.isProfilesFound == false) return;
            if (this.sfpPackage.diffPackageMetadata?.isPayLoadContainTypesSupportedByProfiles == false) return;

            if (this.sfpPackage.diffPackageMetadata?.isProfilesFound) {
                sourceDirectoryPath = path.join(sourceDirectoryPath, 'diff');
            }
        } else {
            if (this.sfpPackage.isProfilesFound == false) return;
            if (this.sfpPackage.isPayLoadContainTypesSupportedByProfiles == false) return;
        }

        if (profileFolders.length > 0) {
            SFPLogger.log(`Restoring original profiles for reconcile and deploy`, LoggerLevel.INFO, this.logger);
            profileFolders.forEach((folder) => {
                fs.copySync(path.join(tmpdir, folder), path.join(sourceDirectoryPath, folder));
            });

            //Now Reconcile
            let reconcileProfileAgainstOrg: ReconcileProfileAgainstOrgImpl = new ReconcileProfileAgainstOrgImpl(
                target_org,
                sourceDirectoryPath,
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

            //Create componentSet To Be Deployed
            let componentSet = ComponentSet.fromSource(
                path.resolve(profileDeploymentStagingDirectory, sourceDirectory)
            );

            DeploymentOptionDisplayer.printDeploymentOptions(deploymentOptions,this.logger);
            let deploySourceToOrgImpl: DeploySourceToOrgImpl = new DeploySourceToOrgImpl(
                this.sfpOrg,
                this.sfpPackage.sourceDir,
                componentSet,
                deploymentOptions,
                this.logger
            );
            let profileReconcile: DeploySourceResult = await deploySourceToOrgImpl.exec();

            if (!profileReconcile.result) {
                DeployErrorDisplayer.displayErrors(profileReconcile.response,this.logger);
                SFPLogger.log('Unable to deploy reconciled  profiles', LoggerLevel.INFO, this.logger);
            }
        }
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
