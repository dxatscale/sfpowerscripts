import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import fs = require("fs-extra");
import path = require("path");
import PromoteUnlockedPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/PromoteUnlockedPackageImpl"
import ArtifactFilePathFetcher from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import AdmZip = require('adm-zip');
import simplegit, { SimpleGit } from "simple-git/promise";

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'postpack');

export default class Postpack extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:Postpack -v HubOrg --promote --pushtags`
  ];

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  protected static flagsConfig = {
    artifactdir: flags.directory({required: true, char: 'd', description: messages.getMessage('artifactDirectoryFlagDescription'), default: 'artifacts'}),
    promote: flags.boolean({description: messages.getMessage('promoteFlagDescription'), default: false, dependsOn: ['devhubalias']}),
    pushtags: flags.boolean({description: messages.getMessage('pushTagsFlagDescription'), default: false}),
    devhubalias: flags.string({char: 'v', description: messages.getMessage('devhubAliasFlagDescription'), default: 'HubOrg'}),
  };


  public async execute(){
    try {
      let artifacts_filepaths = ArtifactFilePathFetcher.fetchArtifactFilePaths(this.flags.artifactdir);

      if (artifacts_filepaths.length === 0) {
        throw new Error(`No artifacts found at ${this.flags.artifactdir}`);
      }

      if (this.flags.promote) {
        let promotedPackages: string[] = [];
        let unpromotedPackages: string[] = [];
        for (let i = 0; i < artifacts_filepaths.length; i++) {
          let packageMetadata: PackageMetadata = JSON.parse(
            fs.readFileSync(artifacts_filepaths[i]["packageMetadataFilePath"], 'utf8')
          );

          if (packageMetadata["package_type"] === "unlocked") {
            try {
              let promoteUnlockedPackageImpl = new PromoteUnlockedPackageImpl(
                process.cwd(),
                packageMetadata["package_version_id"],
                this.flags.devhubalias
              );
              await promoteUnlockedPackageImpl.exec();

              promotedPackages.push(packageMetadata["package_name"]);
            } catch (err) {
              // Remove artifacts that failed to promote
              artifacts_filepaths.splice(i,1);
              unpromotedPackages.push(packageMetadata["package_name"]);
            }
          }
        }
        console.log(`Promoted packages:`, promotedPackages);
        console.log(`Failed to promote:`, unpromotedPackages);
      }

      let zip = new AdmZip();
      for (let artifact_filepaths of artifacts_filepaths) {
        let artifactFilepath: string = path.dirname(artifact_filepaths["packageMetadataFilePath"]);
        zip.addLocalFolder(artifactFilepath, path.basename(artifactFilepath));
        console.log(`Zipping ${path.basename(artifactFilepath)}`);
        zip.writeZip(artifactFilepath + `.zip`);
      }

      if (this.flags.pushtags) {
        console.log("Pushing tags");
        let git: SimpleGit = simplegit();
        git.pushTags();
      }

    } catch (err) {
      console.log(err.message);
      // Fail the task when an error occurs
      process.exit(1);
    }
  }
}
