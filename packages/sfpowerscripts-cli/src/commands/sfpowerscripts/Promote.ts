import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import fs = require("fs-extra");
import PromoteUnlockedPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/PromoteUnlockedPackageImpl"
import ArtifactFilePathFetcher from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'promote');

export default class Promote extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:Promote -d path/to/artifacts -v <org>`
  ];

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  protected static flagsConfig = {
    artifactdir: flags.directory({required: true, char: 'd', description: messages.getMessage('artifactDirectoryFlagDescription'), default: 'artifacts'}),
    devhubalias: flags.string({char: 'v', description: messages.getMessage('devhubAliasFlagDescription'), default: 'HubOrg'}),
  };


  public async execute(){
    let unpromotedPackages: {name: string, error: string}[] = [];
    try {
      let artifacts_filepaths = ArtifactFilePathFetcher.fetchArtifactFilePaths(this.flags.artifactdir);

      if (artifacts_filepaths.length === 0) {
        throw new Error(`No artifacts found at ${this.flags.artifactdir}`);
      }

      let result: boolean = true;
      let promotedPackages: string[] = [];
      for (let artifact_filepaths of artifacts_filepaths) {
        let packageMetadata: PackageMetadata = JSON.parse(
          fs.readFileSync(artifact_filepaths["packageMetadataFilePath"], 'utf8')
        );

        if (packageMetadata["package_type"] === "unlocked") {
          try {
            let promoteUnlockedPackageImpl = new PromoteUnlockedPackageImpl(
              artifact_filepaths["sourceDirectoryPath"],
              packageMetadata["package_version_id"],
              this.flags.devhubalias
            );
            await promoteUnlockedPackageImpl.exec();

            promotedPackages.push(packageMetadata["package_name"]);
          } catch (err) {
            result = false;

            unpromotedPackages.push({
              name: packageMetadata["package_name"],
              error: err.message
            });
          }
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
}
