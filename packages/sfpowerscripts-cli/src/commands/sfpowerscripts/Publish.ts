import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import fs = require("fs-extra");
import path = require("path");
import ArtifactFilePathFetcher, {ArtifactFilePaths} from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import child_process = require("child_process");
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/utils/SFPStatsSender";
import SFPLogger from "@dxatscale/sfpowerscripts.core/lib/utils/SFPLogger";

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'publish');

export default class Promote extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:Publish -f path/to/script`,
    `$ sfdx sfpowerscripts:Publish -p -v HubOrg`
  ];

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  protected static flagsConfig = {
    artifactdir: flags.directory({
      required: true, char: 'd',
      description: messages.getMessage('artifactDirectoryFlagDescription'),
      default: 'artifacts'
    }),
    publishpromotedonly: flags.boolean({
      char: 'p',
      description: messages.getMessage('publishPromotedOnlyFlagDescription'),
      default: false,
      dependsOn: ['devhubalias']
    }),
    devhubalias: flags.string({
      char: 'v',
      description: messages.getMessage('devhubAliasFlagDescription')
    }),
    scriptpath: flags.filepath({
      required: true,
      char: 'f',
      description: messages.getMessage('scriptPathFlagDescription')
    })
  };


  public async execute(){
    let nPublishedArtifacts: number = 0;
    let failedArtifacts: string[] = [];
    SFPLogger.isSupressLogs = true;

    let executionStartTime = Date.now();

    try {
      if (!fs.existsSync(this.flags.scriptpath))
        throw new Error(`Script path ${this.flags.scriptpath} does not exist`);

      let packageVersionList: any;
      if (this.flags.publishpromotedonly) {
        let packageVersionListJson: string = child_process.execSync(
          `sfdx force:package:version:list --released -v ${this.flags.devhubalias} --json`,
          {
            cwd: process.cwd(),
            stdio: ['ignore', 'pipe', 'pipe'],
            encoding: 'utf8',
            maxBuffer: 5*1024*1024
          }
        );
        packageVersionList = JSON.parse(packageVersionListJson);
      }

      let artifacts = ArtifactFilePathFetcher.findArtifacts(this.flags.artifactdir);
      let artifactFilePaths = ArtifactFilePathFetcher.fetchArtifactFilePaths(this.flags.artifactdir);

      // Pattern captures two named groups, the "package" name and "version" number
      let pattern = new RegExp("(?<package>^.*)(?:sfpowerscripts_artifact_)(?<version>.*)(?:\.zip)");
      for (let artifact of artifacts) {
        let packageName: string;
        let packageVersionNumber: string;

        let match: RegExpMatchArray = path.basename(artifact).match(pattern);

        if (match !== null) {
          packageName = match.groups.package; // can be an empty string
          if (packageName) {
            // Remove trailing underscore
            packageName = packageName.substring(0, packageName.length - 1);
          }
          packageVersionNumber = match.groups.version;
        } else {
          // artifact filename doesn't match pattern
          continue;
        }

        let {packageType, packageVersionId} = this.getPackageVersionIdAndType(
          artifactFilePaths,
          packageName,
          packageVersionNumber
        );

        if (this.flags.publishpromotedonly && packageType === "unlocked") {
          let isReleased = packageVersionList.result.find( (pkg) => {
            return pkg.SubscriberPackageVersionId === packageVersionId;
          });

          if (!isReleased) {
            failedArtifacts.push(`${packageName} v${packageVersionNumber}`);
            console.log(`Skipping ${packageName} Version ${packageVersionNumber}. Package Version Id ${packageVersionId} has not been promoted.`);
            process.exitCode = 1;
            continue;
          }
        }

        try {
          console.log(`Publishing ${packageName} Version ${packageVersionNumber}...`);
          child_process.execSync(
            `bash -e ${this.flags.scriptpath} ${packageName} ${packageVersionNumber} ${artifact}`,
            {
              cwd: process.cwd(),
              stdio: ['ignore', 'ignore', 'inherit']
            }
          );
          nPublishedArtifacts++;
        } catch (err) {
          failedArtifacts.push(`${packageName} v${packageVersionNumber}`);
          console.log(err.message);
          process.exitCode = 1;
        }
      }

    } catch (err) {
      console.log(err.message);

      // Fail the task when an error occurs
      process.exitCode = 1;
    } finally {
      let totalElapsedTime: number = Date.now() - executionStartTime;

      console.log(
        `----------------------------------------------------------------------------------------------------`
      );
      console.log(
        `${nPublishedArtifacts} artifacts published in ${this.getFormattedTime(
          totalElapsedTime
        )} with {${failedArtifacts.length}} errors`
      );



      if (failedArtifacts.length > 0) {
        console.log(`Packages Failed to Publish`, failedArtifacts);
      }
      console.log(
        `----------------------------------------------------------------------------------------------------`
      );

      let tag = {
        publish_promoted_only: this.flags.publishpromotedonly ? "true" : "false"
      };

      SFPStatsSender.logGauge(
        "publish.duration",
        totalElapsedTime,
        tag
      );

      SFPStatsSender.logGauge(
        "publish.succeeded",
        nPublishedArtifacts,
        tag
      );

      if (failedArtifacts.length > 0) {
        SFPStatsSender.logGauge(
          "publish.failed",
          failedArtifacts.length,
          tag
        );
      }
    }
  }

  private getPackageVersionIdAndType(
    artifactFilePaths: ArtifactFilePaths[],
    packageName,
    packageVersionNumber
  ): {packageType: string, packageVersionId: string}
  {
    let packageType: string;
    let packageVersionId: string;
    let isPackageMetadataFound: boolean;
    for (let artifact of artifactFilePaths) {
      let packageMetadata: PackageMetadata = JSON.parse(fs.readFileSync(artifact.packageMetadataFilePath, 'utf8'));
      if (
        packageMetadata.package_name === packageName &&
        packageMetadata.package_version_number === packageVersionNumber.replace("-", ".")
      ) {
        isPackageMetadataFound = true;
        packageType = packageMetadata.package_type;
        packageVersionId = packageMetadata.package_version_id;
        break;
      }
    }

    if (!isPackageMetadataFound)
      throw new Error(`Unable to find artifact metadata for ${packageName} Version ${packageVersionNumber.replace("-", ".")}`);

    return {packageType: packageType, packageVersionId: packageVersionId};
  }

  private getFormattedTime(milliseconds: number): string {
    let date = new Date(0);
    date.setSeconds(milliseconds / 1000); // specify value for SECONDS here
    let timeString = date.toISOString().substr(11, 8);
    return timeString;
  }
}
