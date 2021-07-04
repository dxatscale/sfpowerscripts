import ScratchOrg from "@dxatscale/sfpowerscripts.core/src/scratchorg/ScratchOrg";
const path = require("path");
import * as fs from "fs-extra";
import lodash = require("lodash");
import AdmZip = require("adm-zip");
import child_process = require("child_process");
import { DeploymentResult } from "../deploy/DeployImpl";
import SFPLogger, { Logger } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";

export default class SourceTrackingResource {
  private readonly aggregatedSourceTrackingDir = ".sfpowerscripts/sourceTrackingFiles";
  private readonly aggregatedUsernameDir = path.join(this.aggregatedSourceTrackingDir, this.scratchOrg.username);
  private readonly aggregatedMaxRevisionFilePath = path.join(this.aggregatedUsernameDir, "maxRevision.json");
  private readonly aggregatedSourcePathinfosFilePath = path.join(this.aggregatedUsernameDir, "sourcePathInfos.json");

  constructor(
    private scratchOrg: ScratchOrg,
    private deploymentResult: DeploymentResult,
    private logger: Logger
  ) {
    fs.mkdirpSync(this.aggregatedUsernameDir);

    this.aggregateSourceTrackingResources();
  }

  /**
   * Deploy source tracking resource to scratch org as a static resource
   */
  deploy(): void {
    // Deploy static resource to SO
    let projectConfig = {
      packageDirectories: [
        {
          path: "force-app",
          default: true
        }
      ],
      namespace: "",
      sourceApiVersion: "49.0"
    };

    fs.writeJSONSync(path.join(this.aggregatedUsernameDir, "sfdx-project.json"), projectConfig, { spaces: 2 });

    // Create empty forceignore to prevent static resource from being ignored
    fs.closeSync(fs.openSync(path.join(this.aggregatedUsernameDir, ".forceignore"), 'w'));

    let staticResourcesDir = path.join(this.aggregatedUsernameDir, "force-app", "main", "default", "staticresources");
    fs.mkdirpSync(staticResourcesDir);

    let zip = new AdmZip();
    zip.addLocalFile(this.aggregatedMaxRevisionFilePath);
    zip.addLocalFile(this.aggregatedSourcePathinfosFilePath);
    zip.writeZip(path.join(staticResourcesDir, "sourceTrackingFiles.zip"));

    let metadataXml: string =
      `<?xml version="1.0" encoding="UTF-8"?>
      <StaticResource xmlns="http://soap.sforce.com/2006/04/metadata">
        <cacheControl>Public</cacheControl>
        <contentType>application/zip</contentType>
      </StaticResource>`;

    fs.writeFileSync(path.join(staticResourcesDir, "sourceTrackingFiles.resource-meta.xml"), metadataXml);

    try {
      child_process.execSync(
        `sfdx force:source:deploy -p force-app -u ${this.scratchOrg.username}`,
        {
          cwd: this.aggregatedUsernameDir,
          encoding: 'utf8',
          stdio: 'pipe'
        }
      );
    } catch (error) {
      SFPLogger.log(
        `Failed to deploy static resources to scratch org`,
        null,
        this.logger
      );
      throw error;
    }
  }

  /**
   * Aggregate source tracking resources, maxRevision.json and sourcePathInfos.json, across artifacts, for scratch org username
   */
  private aggregateSourceTrackingResources() {
    for (let packageInfoOfDeployedArtifact of this.deploymentResult.deployed) {
      let orgsDir = path.join(packageInfoOfDeployedArtifact.sourceDirectory, ".sfdx", "orgs");
      let usernameDir = path.join(orgsDir, this.scratchOrg.username);

      if (!fs.existsSync(usernameDir))
        throw new Error(`Failed to consolidate source tracking files. Unable to find ${usernameDir}`);

      let maxRevisionFilePath = path.join(usernameDir, "maxRevision.json");
      let sourcePathInfosFilePath = path.join(usernameDir, "sourcePathInfos.json");

      if (!fs.existsSync(maxRevisionFilePath) || !fs.existsSync(sourcePathInfosFilePath))
        throw new Error(`Failed to consolidate source tracking files. Missing source tracking files`);

      if (fs.existsSync(this.aggregatedMaxRevisionFilePath) && fs.existsSync(this.aggregatedSourcePathinfosFilePath)) {

        let aggregatedMaxRevision = fs.readJSONSync(this.aggregatedMaxRevisionFilePath, { encoding: "UTF-8" });
        let maxRevision = fs.readJSONSync(maxRevisionFilePath, { encoding: "UTF-8" });
        if (maxRevision.serverMaxRevisionCounter >= aggregatedMaxRevision.serverMaxRevisionCounter) {
          // Update lastRetrievedFromServer field to match serverRevisionCounter
          let maxRevision = fs.readJSONSync(maxRevisionFilePath, { encoding: "UTF-8"});
          Object.values<any>(maxRevision.sourceMembers).forEach((sourceMember) => {
            if (sourceMember.lastRetrievedFromServer === null) {
              sourceMember.lastRetrievedFromServer = sourceMember.serverRevisionCounter;
            }
          });

          fs.writeJSONSync(maxRevisionFilePath, maxRevision, { spaces: 2 });

          // Replace maxRevision.json
          fs.copySync(maxRevisionFilePath, this.aggregatedMaxRevisionFilePath, { overwrite: true });
        }

        // Concatenate sourcePathInfos.json
        let aggregatedSourcePathInfos = fs.readJSONSync(this.aggregatedSourcePathinfosFilePath, { encoding: "UTF-8" });
        let sourcePathInfos = fs.readJSONSync(sourcePathInfosFilePath, { encoding: "UTF-8" });

        this.truncateSourcePathInfos(sourcePathInfos, packageInfoOfDeployedArtifact.sourceDirectory);

        Object.assign(aggregatedSourcePathInfos, sourcePathInfos);

        fs.writeJSONSync(this.aggregatedSourcePathinfosFilePath, aggregatedSourcePathInfos, { spaces: 2 });
      } else {
        fs.copySync(maxRevisionFilePath, this.aggregatedMaxRevisionFilePath);
        fs.copySync(sourcePathInfosFilePath, this.aggregatedSourcePathinfosFilePath);

        let aggregatedSourcePathInfos = fs.readJSONSync(this.aggregatedSourcePathinfosFilePath, { encoding: "UTF-8" });
        this.truncateSourcePathInfos(aggregatedSourcePathInfos, packageInfoOfDeployedArtifact.sourceDirectory);

        fs.writeJSONSync(this.aggregatedSourcePathinfosFilePath, aggregatedSourcePathInfos, { spaces: 2 });
      }
    }
  }

  /**
   * Truncate Source Path Infos by removing source directory and keeping just the package directory
   * @param sourcePathInfos
   * @param sourceDirectory
   */
  private truncateSourcePathInfos(sourcePathInfos: any, sourceDirectory: string) {
    for (let entry of Object.entries<any>(sourcePathInfos)) {
      let newPropName = entry[0].replace(path.resolve(sourceDirectory), "");
      let newPropValue = lodash.cloneDeep(entry[1]);
      newPropValue.sourcePath = newPropValue.sourcePath.replace(path.resolve(sourceDirectory), "");
      sourcePathInfos[newPropName] = newPropValue;

      delete sourcePathInfos[entry[0]];
    }
  }
}