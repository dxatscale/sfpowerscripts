const path = require("path");
import * as fs from "fs-extra";
import lodash = require("lodash");
import AdmZip = require("adm-zip");
import child_process = require("child_process");
import { DeploymentResult } from "../deploy/DeployImpl";
import { Logger } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import { Connection } from "@salesforce/core";

export default class SourceTrackingResourceController {
  private readonly aggregatedSourceTrackingDir = ".sfpowerscripts/sourceTrackingFiles";
  private readonly aggregatedUsernameDir = path.join(this.aggregatedSourceTrackingDir, this.conn.getUsername());

  private readonly aggregatedMaxRevisionFilePath = path.join(this.aggregatedUsernameDir, "maxRevision.json");
  private readonly aggregatedSourcePathinfosFilePath = path.join(this.aggregatedUsernameDir, "sourcePathInfos.json");

  constructor(
    private conn: Connection,
    private logger: Logger
  ) {
    fs.mkdirpSync(this.aggregatedUsernameDir);
    this.conn.metadata.pollTimeout = 33*60*1000;
    this.conn.metadata.pollInterval = 30000;
  }

  /**
   * Deploy source tracking resource to scratch org as a static resource
   */
  async deploy(): Promise<void> {
    const pkgDir = path.join(this.aggregatedUsernameDir, "pkg");
    const staticResourcesDir = path.join(pkgDir, "staticresources");
    fs.mkdirpSync(staticResourcesDir);

    let resourceZip = new AdmZip()
    resourceZip.addLocalFile(this.aggregatedMaxRevisionFilePath);
    resourceZip.addLocalFile(this.aggregatedSourcePathinfosFilePath);
    resourceZip.writeZip(path.join(staticResourcesDir, "sourceTrackingFiles.resource"));

    let metadataXml: string =
      `<?xml version="1.0" encoding="UTF-8"?>
      <StaticResource xmlns="http://soap.sforce.com/2006/04/metadata">
        <cacheControl>Public</cacheControl>
        <contentType>application/zip</contentType>
      </StaticResource>`;

    fs.writeFileSync(path.join(staticResourcesDir, "sourceTrackingFiles.resource-meta.xml"), metadataXml);

    let packageXml: string =
      `<Package xmlns="http://soap.sforce.com/2006/04/metadata">
        <types>
          <name>StaticResource</name>
          <members>sourceTrackingFiles</members>
        </types>
        <version>50.0</version>
      </Package>`;

    fs.writeFileSync(path.join(pkgDir, "package.xml"), packageXml);

    let metadataZip = new AdmZip();
    metadataZip.addLocalFolder(pkgDir, "pkg");
    metadataZip.writeZip(path.join(this.aggregatedUsernameDir, "pkg.zip"));

    let metadataZipStream = fs.createReadStream(path.join(this.aggregatedUsernameDir, "pkg.zip"));

    await this.conn.metadata.deploy(metadataZipStream, {runAllTests: false, checkOnly: false, rollbackOnError: true}).complete();
  }

  /**
   * Retrieve source tracking resources for scratch org
   */
  async retrieve(): Promise<void> {

    let retrieveResult = (await this.conn.metadata.retrieve({ unpackaged: {types: [{name: "StaticResource", members: ["sourceTrackingFiles"]}], version: "50.0"} }).complete()) as any

    fs.writeFileSync(path.join(this.aggregatedUsernameDir, "pkg.zip"), retrieveResult.zipFile, {encoding: 'base64'});

    let pkgZip = new AdmZip(path.join(this.aggregatedUsernameDir, "pkg.zip"));
    pkgZip.extractAllTo(this.aggregatedUsernameDir, true);

    let resourceZip = new AdmZip(path.join(this.aggregatedUsernameDir, "unpackaged", "staticresources", "sourceTrackingFiles.resource"));
    resourceZip.extractAllTo(path.join(this.aggregatedUsernameDir, "unpackaged", "staticresources"));

    let sfdxSourceTrackingResourceDir = `.sfdx/orgs/${this.conn.getUsername()}`;
    let sfdxMaxRevisionFilePath = path.join(sfdxSourceTrackingResourceDir, "maxRevision.json");
    let sfdxSourcePathInfosFilePath = path.join(sfdxSourceTrackingResourceDir, "sourcePathInfos.json");

    fs.mkdirpSync(sfdxSourceTrackingResourceDir);
    fs.copySync(path.join(this.aggregatedUsernameDir, "unpackaged", "staticresources", "maxRevision.json"), sfdxMaxRevisionFilePath);
    fs.copySync(path.join(this.aggregatedUsernameDir, "unpackaged", "staticresources", "sourcePathInfos.json"), sfdxSourcePathInfosFilePath);

    let sfdxSourcePathInfos = fs.readJSONSync(sfdxSourcePathInfosFilePath, {encoding: "UTF-8"});

    this.untruncateSourcePathInfos(sfdxSourcePathInfos);

    fs.writeJSONSync(sfdxSourcePathInfosFilePath, sfdxSourcePathInfos, { spaces: 2 });

    // Prevent source tracking files from being shown as a remote addition
    this.trackStaticResource(sfdxMaxRevisionFilePath);

  }

  /**
   * Create source tracking resources by aggregating maxRevision.json and sourcePathInfos.json across artifacts, for scratch org username
   */
  createSourceTrackingResources(deploymentResult: DeploymentResult) {
    for (let packageInfoOfDeployedArtifact of deploymentResult.deployed) {
      if (packageInfoOfDeployedArtifact.packageMetadata.package_type === "data") continue;

      let orgsDir = path.join(packageInfoOfDeployedArtifact.sourceDirectory, ".sfdx", "orgs");
      let usernameDir = path.join(orgsDir, this.conn.getUsername());

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
   * Track static resource 'sourceTrackingFiles' by updating 'lastRetrievedFromServer' field
   * Prevents source tracking files from being shown as a remote addition
   * @param sfdxMaxRevisionFilePath
   */
     private trackStaticResource(sfdxMaxRevisionFilePath: string) {
      child_process.execSync(
        `sfdx force:source:status -u ${this.conn.getUsername()}`,
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