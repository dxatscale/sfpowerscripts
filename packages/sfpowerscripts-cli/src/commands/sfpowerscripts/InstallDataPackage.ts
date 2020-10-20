import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';
import InstallDataPackageImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallDataPackageImpl'
import ManifestHelpers from '@dxatscale/sfpowerscripts.core/lib/manifest/ManifestHelpers';
import { Messages } from '@salesforce/core';
const fs = require("fs");
const path = require("path");

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'install_data_package');

export default class InstallDataPackage extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:InstallDataPackage -n mypackage -u <org>`
  ];


  protected static flagsConfig = {
    package: flags.string({char: 'n', description: messages.getMessage('packageFlagDescription'), required: true}),
    targetorg: flags.string({char: 'u', description: messages.getMessage('targetOrgFlagDescription'), required: true}),
    artifactdir: flags.directory({description: messages.getMessage('artifactDirectoryFlagDescription'), default: 'artifacts'}),
    skiponmissingartifact: flags.boolean({description: messages.getMessage('skipOnMissingArtifactFlagDescription')}),
    subdirectory: flags.directory({description: messages.getMessage('subdirectoryFlagDescription')})
  };

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  public async execute(){
   try {

      const targetOrg: string = this.flags.targetorg;
      const sfdx_package: string = this.flags.package;
      let skip_on_missing_artifact: boolean = this.flags.skiponmissingartifact;

      const artifact_directory: string = this.flags.artifactdir;
      const subdirectory: string = this.flags.subdirectory;


      let artifactMetadataFilepath = path.join(
          artifact_directory,
          `${sfdx_package}_sfpowerscripts_artifact`,
          `artifact_metadata.json`
      );

      console.log(`Checking for ${sfdx_package} Build Artifact at path ${artifactMetadataFilepath}`);

      if (!fs.existsSync(artifactMetadataFilepath) && !skip_on_missing_artifact) {
          throw new Error(
          `Artifact not found at ${artifactMetadataFilepath}.. Please check the inputs`
          );
      } else if(!fs.existsSync(artifactMetadataFilepath) && skip_on_missing_artifact) {
          console.log(`Skipping task as artifact is missing, and 'SkipOnMissingArtifact' ${skip_on_missing_artifact}`);
          process.exit(0);
      }

      let packageMetadata = JSON.parse(fs
      .readFileSync(artifactMetadataFilepath)
      .toString());

      console.log("Package Metadata:");
      console.log(packageMetadata);

      let sourceDirectory: string = path.join(
        artifact_directory,
        `${sfdx_package}_sfpowerscripts_artifact`,
        `source`
      )

      let packageDescriptor = ManifestHelpers.getSFDXPackageDescriptor(sourceDirectory, sfdx_package);

      let packageDirectory: string;
      if (subdirectory) {
        packageDirectory = path.join(
          packageDescriptor["path"],
          subdirectory
        );
      } else {
        packageDirectory = path.join(
          packageDescriptor["path"]
        )
      }

      let absPackageDirectory: string = path.join(sourceDirectory, packageDirectory);
      if (!fs.existsSync(absPackageDirectory)) {
        throw new Error(`Source directory ${absPackageDirectory} does not exist`)
      }

      let installDataPackageImpl: InstallDataPackageImpl = new InstallDataPackageImpl(
        targetOrg,
        sourceDirectory,
        packageDirectory
      )

      await installDataPackageImpl.exec();

    } catch(err) {
      console.log(err);
      process.exit(1);
    }
  }
}
