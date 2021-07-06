import ScratchOrg from "@dxatscale/sfpowerscripts.core/lib/scratchorg/ScratchOrg";
const path = require("path");
import * as fs from "fs-extra";
import lodash = require("lodash");
import AdmZip = require("adm-zip");
import child_process = require("child_process");
import { DeploymentResult } from "../deploy/DeployImpl";
import SFPLogger, { Logger } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";

export default class SourceTrackingResourceController {
  private readonly aggregatedSourceTrackingDir = ".sfpowerscripts/sourceTrackingFiles";
  private readonly aggregatedUsernameDir = path.join(this.aggregatedSourceTrackingDir, this.scratchOrg.username);

  private readonly aggregatedMaxRevisionFilePath = path.join(this.aggregatedUsernameDir, "maxRevision.json");
  private readonly aggregatedSourcePathinfosFilePath = path.join(this.aggregatedUsernameDir, "sourcePathInfos.json");

  private readonly staticResourcesDir = path.join(this.aggregatedUsernameDir, "force-app", "main", "default", "staticresources");

  constructor(
    private scratchOrg: ScratchOrg,
    private logger: Logger
  ) {
    fs.mkdirpSync(this.aggregatedUsernameDir);
    fs.mkdirpSync(this.staticResourcesDir);

    this.createSfdxProject(this.aggregatedUsernameDir);
  }

  /**
   * Deploy source tracking resource to scratch org as a static resource
   */
  deploy(): void {
    let zip = new AdmZip();
    zip.addLocalFile(this.aggregatedMaxRevisionFilePath);
    zip.addLocalFile(this.aggregatedSourcePathinfosFilePath);
    zip.writeZip(path.join(this.staticResourcesDir, "sourceTrackingFiles.zip"));

    let metadataXml: string =
      `<?xml version="1.0" encoding="UTF-8"?>
      <StaticResource xmlns="http://soap.sforce.com/2006/04/metadata">
        <cacheControl>Public</cacheControl>
        <contentType>application/zip</contentType>
      </StaticResource>`;

    fs.writeFileSync(path.join(this.staticResourcesDir, "sourceTrackingFiles.resource-meta.xml"), metadataXml);

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
   * Retrieve source tracking resources for scratch org
   */
  retrieve(): void {
    this.clearStaticResourcesDir();

    try {
      child_process.execSync(
        `sfdx force:source:retrieve -m StaticResource:sourceTrackingFiles -u ${this.scratchOrg.username}`,
        {
          cwd: this.aggregatedUsernameDir,
          encoding: 'utf8',
          stdio: 'pipe'
        }
      );

      let sfdxSourceTrackingResourceDir = `.sfdx/orgs/${this.scratchOrg.username}`;
      let sfdxMaxRevisionFilePath = path.join(sfdxSourceTrackingResourceDir, "maxRevision.json");
      let sfdxSourcePathInfosFilePath = path.join(sfdxSourceTrackingResourceDir, "sourcePathInfos.json");

      fs.mkdirpSync(sfdxSourceTrackingResourceDir);
      fs.copySync(path.join(this.staticResourcesDir, "sourceTrackingFiles", "maxRevision.json"), sfdxMaxRevisionFilePath);
      fs.copySync(path.join(this.staticResourcesDir, "sourceTrackingFiles", "sourcePathInfos.json"), sfdxSourcePathInfosFilePath);

      let sfdxSourcePathInfos = fs.readJSONSync(sfdxSourcePathInfosFilePath, {encoding: "UTF-8"});

      this.untruncateSourcePathInfos(sfdxSourcePathInfos);

      fs.writeJSONSync(sfdxSourcePathInfosFilePath, sfdxSourcePathInfos, { spaces: 2 });

      // Prevent source tracking files from being shown as a remote addition
      this.trackStaticResource(sfdxMaxRevisionFilePath);
    } catch (error) {
      console.log(error);
      SFPLogger.log(
        `Failed to retrieve source tracking files for scratch org`,
        null,
        this.logger
      );
      throw error;
    }
  }

  /**
   * Create source tracking resources by aggregating maxRevision.json and sourcePathInfos.json across artifacts, for scratch org username
   */
  createSourceTrackingResources(deploymentResult: DeploymentResult) {
    for (let packageInfoOfDeployedArtifact of deploymentResult.deployed) {
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

  /**
   * Un-truncate Source Path Infos by prepending source paths with CWD
   * @param sourcePathInfos
   */
  private untruncateSourcePathInfos(sourcePathInfos: any) {
    for (let entry of Object.entries<any>(sourcePathInfos)) {
      let newPropName = path.join(process.cwd(), entry[0]);
      let newPropValue = lodash.cloneDeep(entry[1]);
      newPropValue.sourcePath = path.join(process.cwd(), newPropValue.sourcePath);
      sourcePathInfos[newPropName] = newPropValue;

      delete sourcePathInfos[entry[0]];
    }
  }

  /**
   * Create a barebones SFDX project at the target directory
   */
  private createSfdxProject(targetDirectory: string): void {
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

    fs.writeJSONSync(path.join(targetDirectory, "sfdx-project.json"), projectConfig, { spaces: 2 });

    // Create empty forceignore to prevent static resource from being ignored
    fs.closeSync(fs.openSync(path.join(targetDirectory, ".forceignore"), 'w'));
  }

  private clearStaticResourcesDir() {
    let staticResources = fs.readdirSync(this.staticResourcesDir, { encoding: "utf8" });
    if (staticResources.length > 0) {
      staticResources.forEach((resource) => {
        fs.unlinkSync(path.join(this.staticResourcesDir, resource));
      });
    }
  }

  /**
   * Track static resource 'sourceTrackingFiles' by updating 'lastRetrievedFromServer' field
   * Prevents source tracking files from being shown as a remote addition
   * @param sfdxMaxRevisionFilePath
   */
     private trackStaticResource(sfdxMaxRevisionFilePath: string) {
      child_process.execSync(
        `sfdx force:source:status -u ${this.scratchOrg.username}`,
        {
          encoding: 'utf8',
          stdio: 'pipe'
        }
      );

      let sfdxMaxRevision = fs.readJSONSync(sfdxMaxRevisionFilePath, { encoding: "UTF-8" });

      if (sfdxMaxRevision.sourceMembers.StaticResource__sourceTrackingFiles?.serverRevisionCounter) {
        sfdxMaxRevision.sourceMembers.StaticResource__sourceTrackingFiles.lastRetrievedFromServer = sfdxMaxRevision.sourceMembers.StaticResource__sourceTrackingFiles.serverRevisionCounter;
        fs.writeJSONSync(sfdxMaxRevisionFilePath, sfdxMaxRevision, { spaces: 2 });
      }
    }
}