import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import * as fs from "fs-extra"
import PromoteUnlockedPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/PromoteUnlockedPackageImpl"
import ArtifactFilePathFetcher from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";


Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'promote');

export default class Promote extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:orchestrator:promote -d path/to/artifacts -v <org>`
  ];


  protected static requiresDevhubUsername = true;

  protected static flagsConfig = {
    artifactdir: flags.directory({
      required: true, char: 'd',
      description: messages.getMessage('artifactDirectoryFlagDescription'),
      default: 'artifacts'
    }),
    outputdir: flags.directory({
      required: false,
      char: 'o',
      description: messages.getMessage('outputDirectoryFlagDescription'),
      hidden: true,
      deprecated: {messageOverride:"--outputdir is deprecated, Artifacts are no longer modified after promote"}
    }),
    loglevel: flags.enum({
      description: "logging level for this command invocation",
      default: "info",
      required: false,
      options: [
        "trace",
        "debug",
        "info",
        "warn",
        "error",
        "fatal",
        "TRACE",
        "DEBUG",
        "INFO",
        "WARN",
        "ERROR",
        "FATAL",
      ],
    })
  };


  public async execute(){

    console.log("-----------sfpowerscripts orchestrator ------------------");
    console.log("command: promote");
    console.log(`Artifact Directory: ${this.flags.artifactdir}`);
    console.log("---------------------------------------------------------");


    //Refresh HubOrg Authentication
    await this.hubOrg.refreshAuth();

    let unpromotedPackages: {name: string, error: string}[] = [];
    try {
      let artifacts = ArtifactFilePathFetcher.fetchArtifactFilePaths(this.flags.artifactdir);

      if (artifacts.length === 0) {
        throw new Error(`No artifacts found at ${this.flags.artifactdir}`);
      }


      let result: boolean = true;
      let promotedPackages: string[] = [];
      for (let artifact of artifacts) {
        let packageMetadata: PackageMetadata = JSON.parse(
          fs.readFileSync(artifact.packageMetadataFilePath, 'utf8')
        );

        try {
          if (packageMetadata.package_type === "unlocked") {
            let promoteUnlockedPackageImpl = new PromoteUnlockedPackageImpl(
              artifact.sourceDirectoryPath,
              packageMetadata.package_version_id,
              this.hubOrg.getUsername()
            );
            await promoteUnlockedPackageImpl.exec();
          }


          promotedPackages.push(packageMetadata.package_name);
        } catch (err) {
          result = false;

          unpromotedPackages.push({
            name: packageMetadata.package_name,
            error: err.message
          });
        }
      }
      console.log(`Promoted packages:`, promotedPackages);

      // Overall exit status is 1 if a package failed to promote
      if (!result) {
        throw new Error();
      }
    } catch (err) {
      console.log(err.message);

      // Print unpromoted packages with reason for failure
      if (unpromotedPackages.length > 0) {
        this.ux.table(unpromotedPackages, ["name", "error"]);
      }

      // Fail the task when an error occurs
      process.exitCode = 1;
    }
  }

  private substituteBuildNumberWithPreRelease(
    packageVersionNumber: string
  ) {
    let segments = packageVersionNumber.split(".");

    if (segments.length === 4) {
      packageVersionNumber = segments.reduce(
        (version, segment, segmentsIdx) => {
          if (segmentsIdx === 3) return version + "-" + segment;
          else return version + "." + segment;
        }
      );
    }

    return packageVersionNumber;
  }


}
