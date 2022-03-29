
const path = require('path');
import * as fs from 'fs-extra';
import { Logger } from '../../logger/SFPLogger';
import { Connection, SfdxProject } from '@salesforce/core';
import SFPOrg from "../../org/SFPOrg";
import { SourceTracking } from '@salesforce/source-tracking';
import simplegit, { SimpleGit } from 'simple-git';
import ProjectConfig from "../../project/ProjectConfig";
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

      clientSourceTracking.org = await SFPOrg.create({connection: clientSourceTracking.conn});
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
        project: project
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

}