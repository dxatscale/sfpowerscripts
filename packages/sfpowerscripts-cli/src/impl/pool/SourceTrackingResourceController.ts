const path = require('path');
import * as fs from 'fs-extra';
import AdmZip = require('adm-zip');
import child_process = require('child_process');
import { DeploymentResult } from '../deploy/DeployImpl';
import { Logger } from '@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger';
import { Connection, SfdxProject } from '@salesforce/core';
import SFPOrg from "@dxatscale/sfpowerscripts.core/lib/org/SFPOrg";
import { SourceTracking } from '@salesforce/source-tracking';
import simplegit, { SimpleGit } from 'simple-git';
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";
const tmp = require('tmp');

export default class SourceTrackingResourceController {
    private conn: Connection;
    private org: SFPOrg;
    private logger: Logger;

    // file paths with "aggregated" prefix are for consolidating source tracking files across artifacts
    private aggregatedSourceTrackingDir = '.sfpowerscripts/sourceTrackingFiles';
    private aggregatedOrgIdDir;
    private aggregatedMaxRevisionFilePath;

    private sfdxOrgIdDir;

    private constructor() {}

    static async create(conn: Connection, logger: Logger) {
        const sourceTrackingResourceController = new SourceTrackingResourceController();

        sourceTrackingResourceController.conn = conn;
        conn.metadata.pollTimeout = 33 * 60 * 1000; // 33 minutes
        conn.metadata.pollInterval = 30000; // 30 seconds

        sourceTrackingResourceController.org = await SFPOrg.create({connection: sourceTrackingResourceController.conn});
        sourceTrackingResourceController.logger = logger;

        sourceTrackingResourceController.aggregatedOrgIdDir = path.join(
            sourceTrackingResourceController.aggregatedSourceTrackingDir,
            sourceTrackingResourceController.org.getOrgId()
        );
        fs.mkdirpSync(sourceTrackingResourceController.aggregatedOrgIdDir);
        sourceTrackingResourceController.aggregatedMaxRevisionFilePath = path.join(
            sourceTrackingResourceController.aggregatedOrgIdDir,
            'maxRevision.json'
        );

        sourceTrackingResourceController.sfdxOrgIdDir = `.sfdx/orgs/${sourceTrackingResourceController.org.getOrgId()}`;

        return sourceTrackingResourceController;
    }

    /**
     * Deploy source tracking resource to scratch org as a static resource
     */
    async deploy(): Promise<void> {
        const pkgDir = path.join(this.aggregatedOrgIdDir, 'pkg');
        const staticResourcesDir = path.join(pkgDir, 'staticresources');
        fs.mkdirpSync(staticResourcesDir);

        let resourceZip = new AdmZip();
        resourceZip.addLocalFile(this.aggregatedMaxRevisionFilePath);
        resourceZip.writeZip(path.join(staticResourcesDir, 'sourceTrackingFiles.resource'));

        let metadataXml: string = `<?xml version="1.0" encoding="UTF-8"?>
      <StaticResource xmlns="http://soap.sforce.com/2006/04/metadata">
        <cacheControl>Public</cacheControl>
        <contentType>application/zip</contentType>
      </StaticResource>`;

        fs.writeFileSync(path.join(staticResourcesDir, 'sourceTrackingFiles.resource-meta.xml'), metadataXml);

        let packageXml: string = `<Package xmlns="http://soap.sforce.com/2006/04/metadata">
        <types>
          <name>StaticResource</name>
          <members>sourceTrackingFiles</members>
        </types>
        <version>50.0</version>
      </Package>`;

        fs.writeFileSync(path.join(pkgDir, 'package.xml'), packageXml);

        let metadataZip = new AdmZip();
        metadataZip.addLocalFolder(pkgDir, 'pkg');
        metadataZip.writeZip(path.join(this.aggregatedOrgIdDir, 'pkg.zip'));

        let metadataZipStream = fs.createReadStream(path.join(this.aggregatedOrgIdDir, 'pkg.zip'));

        await this.conn.metadata
            .deploy(metadataZipStream, { runAllTests: false, checkOnly: false, rollbackOnError: true })
            .complete();
    }

    /**
     * Retrieve source tracking resources for scratch org
     */
    async retrieve(): Promise<void> {
        let retrieveResult = (await this.conn.metadata
            .retrieve({
                unpackaged: { types: [{ name: 'StaticResource', members: ['sourceTrackingFiles'] }], version: '50.0' },
            })
            .complete()) as any;

        fs.writeFileSync(path.join(this.aggregatedOrgIdDir, 'pkg.zip'), retrieveResult.zipFile, {
            encoding: 'base64',
        });

        let pkgZip = new AdmZip(path.join(this.aggregatedOrgIdDir, 'pkg.zip'));
        pkgZip.extractAllTo(this.aggregatedOrgIdDir, true);

        let resourceZip = new AdmZip(
            path.join(this.aggregatedOrgIdDir, 'unpackaged', 'staticresources', 'sourceTrackingFiles.resource')
        );
        resourceZip.extractAllTo(path.join(this.aggregatedOrgIdDir, 'unpackaged', 'staticresources'));

        fs.mkdirpSync(this.sfdxOrgIdDir);
        let sfdxMaxRevisionFilePath = path.join(this.sfdxOrgIdDir, 'maxRevision.json');
        fs.copySync(
            path.join(this.aggregatedOrgIdDir, 'unpackaged', 'staticresources', 'maxRevision.json'),
            sfdxMaxRevisionFilePath
        );

        await this.createLocalSourceTracking();

        // Prevent source tracking files from being shown as a remote addition
        this.trackStaticResource(sfdxMaxRevisionFilePath);
    }

    /**
     * Create source tracking resources by aggregating maxRevision.json and across artifacts, for scratch org ID
     */
    async createSourceTrackingResources(deploymentResult: DeploymentResult) {

        for (let packageInfoOfDeployedArtifact of deploymentResult.deployed) {
            if (packageInfoOfDeployedArtifact.packageMetadata.package_type === 'data') continue;

            let orgsDir = path.join(packageInfoOfDeployedArtifact.sourceDirectory, '.sfdx', 'orgs');
            let orgIdDir = path.join(orgsDir, this.org.getOrgId());

            if (!fs.existsSync(orgIdDir)) {
                throw new Error(`Failed to consolidate source tracking files. Unable to find ${orgIdDir}`);
            }

            let maxRevisionFilePath = path.join(orgIdDir, 'maxRevision.json');

            if (!fs.existsSync(maxRevisionFilePath)) {
                throw new Error(`Failed to consolidate source tracking files. Missing source tracking files`);
            }

            if (
                fs.existsSync(this.aggregatedMaxRevisionFilePath)
            ) {
                let aggregatedMaxRevision = fs.readJSONSync(this.aggregatedMaxRevisionFilePath, { encoding: 'UTF-8' });
                let maxRevision = fs.readJSONSync(maxRevisionFilePath, { encoding: 'UTF-8' });
                if (maxRevision.serverMaxRevisionCounter >= aggregatedMaxRevision.serverMaxRevisionCounter) {
                    // Update lastRetrievedFromServer field to match serverRevisionCounter
                    let maxRevision = fs.readJSONSync(maxRevisionFilePath, { encoding: 'UTF-8' });
                    Object.values<any>(maxRevision.sourceMembers).forEach((sourceMember) => {
                        if (sourceMember.lastRetrievedFromServer === null) {
                            sourceMember.lastRetrievedFromServer = sourceMember.serverRevisionCounter;
                        }
                    });

                    fs.writeJSONSync(maxRevisionFilePath, maxRevision, { spaces: 2 });

                    // Replace maxRevision.json
                    fs.copySync(maxRevisionFilePath, this.aggregatedMaxRevisionFilePath, { overwrite: true });
                }
            } else {
                fs.copySync(maxRevisionFilePath, this.aggregatedMaxRevisionFilePath);
            }
        }
    }

    /**
     * Create local source tracking from sfpowerscripts artifacts installed in scratch org
     */
    private async createLocalSourceTracking() {

        let tempDir = tmp.dirSync({ unsafeCleanup: true });
        try {
            let git: SimpleGit = simplegit();
            const repoPath = (await git.getConfig('remote.origin.url')).value
            await git.clone(repoPath, tempDir.name);

            const sfpowerscriptsArtifacts = await this.org.getInstalledArtifacts();

            const project = await SfdxProject.resolve(tempDir.name);

            // Create local source tracking files in temp repo
            const tracking = await SourceTracking.create({
                org: this.org,
                project: project
            });
            tracking.ensureLocalTracking();

            git = simplegit(tempDir.name);
            for (const artifact of sfpowerscriptsArtifacts) {
                // Checkout version of source code from which artifact was created
                git.checkout(artifact.CommitId__c);

                const projectConfig = ProjectConfig.getSFDXPackageManifest(tempDir.name);

                const packageType = ProjectConfig.getPackageType(projectConfig, artifact.Name);
                if (packageType === "Unlocked" || packageType === "Source") {
                    await tracking.updateLocalTracking({
                        files: [
                            ProjectConfig.getPackageDescriptorFromConfig(artifact.Name, projectConfig).path
                        ]
                    })
                }
            }

            // Copy source tracking files from temp repo to actual repo
            fs.mkdirpSync(path.join(this.sfdxOrgIdDir, "localSourceTracking"));
            fs.copySync(path.join(tempDir.name, this.sfdxOrgIdDir, "localSourceTracking"), path.join(this.sfdxOrgIdDir, "localSourceTracking"));
        } finally {
            tempDir.removeCallback();
        }
    }

    /**
     * Track static resource 'sourceTrackingFiles' by updating 'lastRetrievedFromServer' field
     * Prevents source tracking files from being shown as a remote addition
     * @param sfdxMaxRevisionFilePath
     */
    private trackStaticResource(sfdxMaxRevisionFilePath: string) {
        child_process.execSync(`sfdx force:source:beta:status -u ${this.conn.getUsername()}`, {
            encoding: 'utf8',
            stdio: 'pipe',
        });

        let sfdxMaxRevision = fs.readJSONSync(sfdxMaxRevisionFilePath, { encoding: 'UTF-8' });

        if (sfdxMaxRevision.sourceMembers.StaticResource__sourceTrackingFiles?.serverRevisionCounter) {
            sfdxMaxRevision.sourceMembers.StaticResource__sourceTrackingFiles.lastRetrievedFromServer =
                sfdxMaxRevision.sourceMembers.StaticResource__sourceTrackingFiles.serverRevisionCounter;
            fs.writeJSONSync(sfdxMaxRevisionFilePath, sfdxMaxRevision, { spaces: 2 });
        }
    }
}
