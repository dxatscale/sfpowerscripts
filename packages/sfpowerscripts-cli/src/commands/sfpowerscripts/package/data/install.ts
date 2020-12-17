import { flags } from '@salesforce/command';
import InstallDataPackageImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallDataPackageImpl';
import { Messages } from '@salesforce/core';
import SFPStatsSender from '@dxatscale/sfpowerscripts.core/lib/utils/SFPStatsSender';
import InstallPackageCommand from '../../../../InstallPackageCommand';
import { PackageInstallationStatus } from '@dxatscale/sfpowerscripts.core/lib/package/PackageInstallationResult';
const fs = require("fs");

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'install_data_package');

export default class InstallDataPackage extends InstallPackageCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:package:data:install -n mypackage -u <org>`
  ];


  protected static flagsConfig = {
    package: flags.string({char: 'n', description: messages.getMessage('packageFlagDescription'), required: true}),
    targetorg: flags.string({char: 'u', description: messages.getMessage('targetOrgFlagDescription'), required: true}),
    artifactdir: flags.directory({description: messages.getMessage('artifactDirectoryFlagDescription'), default: 'artifacts'}),
    skiponmissingartifact: flags.boolean({char: 's', description: messages.getMessage('skipOnMissingArtifactFlagDescription')}),
    skipifalreadyinstalled: flags.boolean({description: messages.getMessage("skipIfAlreadyInstalled")}),
  };

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  public async install(){
   try {

      const targetOrg: string = this.flags.targetorg;
      const sfdx_package: string = this.flags.package;
      const skipIfAlreadyInstalled = this.flags.skipifalreadyinstalled;

      let startTime=Date.now();

      let artifactMetadataFilepath = this.artifactFilePaths.packageMetadataFilePath;

      let packageMetadata = JSON.parse(fs
      .readFileSync(artifactMetadataFilepath)
      .toString());

      console.log("Package Metadata:");
      console.log(packageMetadata);

      let sourceDirectory: string = this.artifactFilePaths.sourceDirectoryPath;

      let installDataPackageImpl: InstallDataPackageImpl = new InstallDataPackageImpl(
        sfdx_package,
        targetOrg,
        sourceDirectory,
        packageMetadata,
        skipIfAlreadyInstalled
      )

      let result = await installDataPackageImpl.exec();

      let elapsedTime=Date.now()-startTime;

      if (result.result === PackageInstallationStatus.Failed) {
        SFPStatsSender.logCount("package.installation.failure",{package:sfdx_package,type:"data"});
        throw new Error(result.message);
      } else if (result.result === PackageInstallationStatus.Succeeded) {
        SFPStatsSender.logElapsedTime("package.installation.elapsed_time",elapsedTime,{package:sfdx_package,type:"unlocked", target_org:targetOrg});
        SFPStatsSender.logCount("package.installation",{package:sfdx_package,type:"unlocked",target_org:targetOrg});
      }



    } catch(err) {
      console.log(err);
      process.exitCode=1;
    }
  }
}
