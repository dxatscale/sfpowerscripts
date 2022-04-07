const path = require('path');
import * as fs from 'fs-extra';
import SFPLogger, { COLOR_HEADER, COLOR_KEY_MESSAGE, Logger, LoggerLevel } from '../../logger/SFPLogger';
import { Connection, SfdxProject } from '@salesforce/core';
import SFPOrg from '../../org/SFPOrg';
import { SourceTracking } from '@salesforce/source-tracking';
import simplegit, { SimpleGit } from 'simple-git';
import ProjectConfig from '../../project/ProjectConfig';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { EOL } from 'os';

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

        clientSourceTracking.sfdxOrgIdDir = `.sfdx/orgs/${clientSourceTracking.org.getOrgId()}`;

        return clientSourceTracking;
    }

    async creatSourceTrackingFiles(): Promise<void> {
        await this.createRemoteSourceTracking();
        await this.createLocalSourceTracking();
    }

    private async createRemoteSourceTracking() {
        const project = await SfdxProject.resolve();
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
        let tempDir = tmp.dirSync({ unsafeCleanup: true });
        try {
            let git: SimpleGit = simplegit();
            const repoPath = (await git.getConfig('remote.origin.url')).value;
            await git.clone(repoPath, tempDir.name);

            //Order by commit id.. so that we can eliminate multiple checkouts
            const sfpowerscriptsArtifacts = await this.org.getInstalledArtifacts('CommitId__c');

            const project = await SfdxProject.resolve(tempDir.name);

            // Create local source tracking files in temp repo
            const tracking = await SourceTracking.create({
                org: this.org,
                project: project,
            });
            tracking.ensureLocalTracking();

            git = simplegit(tempDir.name);

            SFPLogger.log(`Total Artifacts to Analyze: ${sfpowerscriptsArtifacts.length}`, LoggerLevel.INFO);

            let count = 1;
            for (const artifact of sfpowerscriptsArtifacts) {
                SFPLogger.log(EOL, LoggerLevel.INFO);
                SFPLogger.log(COLOR_HEADER(`Package ${count} of ${sfpowerscriptsArtifacts.length}`), LoggerLevel.INFO);
                SFPLogger.log(`Analyzing package ${COLOR_KEY_MESSAGE(artifact.Name)}`, LoggerLevel.INFO);
                // Checkout version of source code from which artifact was created
                await git.checkout(artifact.CommitId__c);
                SFPLogger.log(
                    `Version pushed while preparing this org is ${artifact.Version__c} with SHA ${artifact.CommitId__c}`,
                    LoggerLevel.INFO
                );

                const projectConfig = ProjectConfig.getSFDXPackageManifest(tempDir.name);

                try {
                    const packageType = ProjectConfig.getPackageType(projectConfig, artifact.Name);
                    if (packageType === 'Unlocked' || packageType === 'Source') {
                        let componentSet = ComponentSet.fromSource(
                            path.join(
                                tempDir.name,
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
                            LoggerLevel.INFO
                        );
                    } else SFPLogger.log(`Encountered data package... skipping`, LoggerLevel.INFO);
                } catch (error) {
                    SFPLogger.log(`Unable to update local source tracking due to ${error.message}`, LoggerLevel.INFO);
                    SFPLogger.log(`Skipping package.. ${artifact.Name}`, LoggerLevel.WARN);
                }
                count++;
            }

            SFPLogger.log(EOL, LoggerLevel.INFO);
            SFPLogger.log(`Copying the temporary repository over to original location`, LoggerLevel.INFO);
            // Copy source tracking files from temp repo to actual repo
            fs.mkdirpSync(path.join(this.sfdxOrgIdDir, 'localSourceTracking'));
            fs.copySync(
                path.join(tempDir.name, this.sfdxOrgIdDir, 'localSourceTracking'),
                path.join(this.sfdxOrgIdDir, 'localSourceTracking')
            );
        } catch (error) {
            SFPLogger.log(`Unable to update local source tracking due to ${error.message}`, LoggerLevel.ERROR);
        } finally {
            tempDir.removeCallback();
        }
    }
}
