const path = require('path');
import * as fs from 'fs-extra';
import SFPLogger, { COLOR_HEADER, COLOR_KEY_MESSAGE, Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { Connection, SfProject } from '@salesforce/core';
import SFPOrg from '../../org/SFPOrg';
import { SourceTracking } from '@salesforce/source-tracking';
import ProjectConfig from '../../project/ProjectConfig';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { EOL } from 'os';
import { PackageType } from '../../package/SfpPackage';
import Git from '../../git/Git';

const tmp = require('tmp');

export default class ClientSourceTracking {
    private conn: Connection;
    private org: SFPOrg;
    private logger: Logger;

    private sfdxOrgIdDir;

    private constructor() {}

    static async create(conn: Connection, logger: Logger) {
        const clientSourceTracking = new ClientSourceTracking();

        clientSourceTracking.conn = conn;

        clientSourceTracking.org = await SFPOrg.create({ connection: clientSourceTracking.conn });
        clientSourceTracking.logger = logger;

        clientSourceTracking.sfdxOrgIdDir = `.sf/orgs/${clientSourceTracking.org.getOrgId()}`;

        return clientSourceTracking;
    }

    async creatSourceTrackingFiles(): Promise<void> {
        await this.createRemoteSourceTracking();
        await this.createLocalSourceTracking();
    }

    private async createRemoteSourceTracking() {
        const project = await SfProject.resolve();
        const tracking = await SourceTracking.create({
            org: this.org,
            project: project,
        });

        tracking.resetRemoteTracking();
    }

    /**
     * Create local source tracking from sfpowerscripts artifacts installed in scratch org
     */
    private async createLocalSourceTracking() {
        
        let git;
        try {
            git = await Git.initiateRepoAtTempLocation(this.logger);

            const sfpowerscriptsArtifacts = await this.org.getInstalledArtifacts();

            if(sfpowerscriptsArtifacts.length==0)
             throw new Error(`Unable to find any artifacts in the org`);

            //clean up MPD to just one package, so that source tracking lib
            //does do a full scan and break
            this.cleanupSFDXProjectJsonTonOnePackage(git.getRepositoryPath(), sfpowerscriptsArtifacts[0].Name);

            const project = await SfProject.resolve(git.getRepositoryPath());

            // Create local source tracking files in temp repo
            const tracking = await SourceTracking.create({
                org: this.org,
                project: project,
            });

           

            SFPLogger.log(
                `Total Artifacts to Analyze: ${sfpowerscriptsArtifacts.length}`,
                LoggerLevel.INFO,
                this.logger
            );

            let count = 1;
            for (const artifact of sfpowerscriptsArtifacts) {
                SFPLogger.log(EOL, LoggerLevel.INFO, this.logger);
                SFPLogger.log(
                    COLOR_HEADER(`Package ${count} of ${sfpowerscriptsArtifacts.length}`),
                    LoggerLevel.INFO,
                    this.logger
                );
                SFPLogger.log(`Analyzing package ${COLOR_KEY_MESSAGE(artifact.Name)}`, LoggerLevel.INFO, this.logger);
                // Checkout version of source code from which artifact was created
                await git.checkout(artifact.CommitId__c,true)

                SFPLogger.log(
                    `Version pushed while preparing this org is ${artifact.Version__c} with SHA ${artifact.CommitId__c}`,
                    LoggerLevel.INFO,
                    this.logger
                );

                //clean up MPD to per package, to speed up
                this.cleanupSFDXProjectJsonTonOnePackage(git.getRepositoryPath(), artifact.Name);

                const projectConfig = ProjectConfig.getSFDXProjectConfig(git.getRepositoryPath());

                try {
                    const packageType = ProjectConfig.getPackageType(projectConfig, artifact.Name);
                    if (packageType === PackageType.Unlocked || packageType === PackageType.Source) {
                        let componentSet = ComponentSet.fromSource(
                            path.join(
                                git.getRepositoryPath(),
                                ProjectConfig.getPackageDescriptorFromConfig(artifact.Name, projectConfig).path
                            )
                        );
                        let components = componentSet.getSourceComponents();

                        //Get all components in the directory
                        //Count for logging purposes. dont have to waste processing convering
                        //a lazy collection to array once again
                        let componentCount = 1;
                        let componentPaths: string[] = [];
                        for (const component of components) {
                            componentCount++;
                            componentPaths.push(component.xml);
                            if (component.content) componentPaths.push(component.content);
                        }

                        await tracking.updateLocalTracking({
                            files: componentPaths,
                        });
                        SFPLogger.log(
                            `Updated source tracking for package: ${artifact.Name} with ${componentCount} items`,
                            LoggerLevel.INFO,
                            this.logger
                        );
                    } else SFPLogger.log(`Encountered data package... skipping`, LoggerLevel.INFO, this.logger);
                } catch (error) {
                    if(error.message.includes)
                    {
                    SFPLogger.log(
                        ` sfpowerscripts is unable to sync the package ${artifact.name}${EOL}, 
                          as it not able to find the find equivalent git references`,
                        LoggerLevel.ERROR,
                        this.logger);
                    }
                    else    
                    SFPLogger.log(
                        `Unable to update local source tracking due to ${error.message}`,
                        LoggerLevel.INFO,
                        this.logger
                    );
                    SFPLogger.log(`Skipping package.. ${artifact.Name}`, LoggerLevel.WARN, this.logger);
                }
                count++;
            }

            SFPLogger.log(EOL, LoggerLevel.INFO, this.logger);
            SFPLogger.log(`Copying the temporary repository over to original location`, LoggerLevel.INFO, this.logger);
            // Copy source tracking files from temp repo to actual repo
            fs.mkdirpSync(path.join(this.sfdxOrgIdDir, 'localSourceTracking'));
            fs.copySync(
                path.join(git.getRepositoryPath(), this.sfdxOrgIdDir, 'localSourceTracking'),
                path.join(this.sfdxOrgIdDir, 'localSourceTracking')
            );
        } catch (error) {

            if(error.message.includes(`reference is not a tree`))
            {
                SFPLogger.log(
                    `sfpowerscripts is unable to sync this repository, 
                     as it not able to find the matching git references${EOL}
                     Are you sure this pool was created from the same repository?`,
                    LoggerLevel.ERROR,
                    this.logger);
            }
            else
            SFPLogger.log(
                `Unable to update local source tracking due to ${error.message}`,
                LoggerLevel.ERROR,
                this.logger
            );
        } finally {
            if(git)
              git.deleteTempoRepoIfAny();
        }
    }

    private cleanupSFDXProjectJsonTonOnePackage(projectDir: string, packageName: string) {
        try {
            let cleanedUpProjectManifest = ProjectConfig.cleanupMPDFromProjectDirectory(projectDir, packageName);
            fs.writeJSONSync(path.join(projectDir, 'sfdx-project.json'), cleanedUpProjectManifest, {
                spaces: 4,
            });
        } catch (error) {
            SFPLogger.log(
                `sfdx-project.json not found/unable to write, skipping..` + error.message,
                LoggerLevel.DEBUG,
                this.logger
            );
        }
    }
}
