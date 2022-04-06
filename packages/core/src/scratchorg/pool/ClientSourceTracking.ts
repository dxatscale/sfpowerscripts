const path = require('path');
import * as fs from 'fs-extra';
import SFPLogger, { COLOR_KEY_MESSAGE, Logger, LoggerLevel } from '../../logger/SFPLogger';
import { Connection, SfdxProject } from '@salesforce/core';
import SFPOrg from '../../org/SFPOrg';
import { SourceTracking } from '@salesforce/source-tracking';
import simplegit, { SimpleGit } from 'simple-git';
import ProjectConfig from '../../project/ProjectConfig';
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

            const sfpowerscriptsArtifacts = await this.org.getInstalledArtifacts();

            const project = await SfdxProject.resolve(tempDir.name);

            // Create local source tracking files in temp repo
            const tracking = await SourceTracking.create({
                org: this.org,
                project: project,
            });
            tracking.ensureLocalTracking();

            git = simplegit(tempDir.name);
            for (const artifact of sfpowerscriptsArtifacts) {
                SFPLogger.log(`Analyzing package ${COLOR_KEY_MESSAGE(artifact.Name)}`, LoggerLevel.INFO);
                // Checkout version of source code from which artifact was created
                git.checkout(artifact.CommitId__c);
                SFPLogger.log(`Version pushed while preparing this org ${artifact.Version__c}`, LoggerLevel.INFO);
                SFPLogger.log(`Checked out SHA ${artifact.CommitId__c}`, LoggerLevel.INFO);
                const projectConfig = ProjectConfig.getSFDXPackageManifest(tempDir.name);

                try {
                    const packageType = ProjectConfig.getPackageType(projectConfig, artifact.Name);
                    if (packageType === 'Unlocked' || packageType === 'Source') {
                        SFPLogger.log(`Fixing tracking for ${COLOR_KEY_MESSAGE(artifact.Name)}`, LoggerLevel.INFO);
                        await tracking.updateLocalTracking({
                            files: [ProjectConfig.getPackageDescriptorFromConfig(artifact.Name, projectConfig).path],
                        });
                    }
                    else
                      SFPLogger.log(`Data Package Encountered.. skipping`, LoggerLevel.INFO);
                } catch (error) {
                    SFPLogger.log(`Unable to update local source tracking due to ${error.message}`, LoggerLevel.INFO);
                    SFPLogger.log(`Skipping package.. ${COLOR_KEY_MESSAGE(artifact.Name)}`,LoggerLevel.WARN);
                }
            }

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
