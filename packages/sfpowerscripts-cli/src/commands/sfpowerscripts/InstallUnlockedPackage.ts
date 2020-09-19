import InstallUnlockedPackageImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallUnlockedPackageImpl';
import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
const fs = require("fs");
const path = require("path");

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'install_unlocked_package');

export default class InstallUnlockedPackage extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:InstallUnlockedPackage -n packagename -u sandboxalias -i`
  ];


  protected static flagsConfig = {
    package: flags.string({char: 'n', description: messages.getMessage('packageFlagDescription')}),
    targetorg: flags.string({char: 'u', description: messages.getMessage('envNameFlagDescription')}),
    packageinstalledfrom: flags.boolean({char: 'i', description: messages.getMessage('packageInstalledFromFlagDescription')}),
    packageversionid: flags.string({char: 'v', description: messages.getMessage('packageVersionIdFlagDescription'), exclusive: ['packageinstalledfrom']}),
    installationkey : flags.string({char: 'k', description: messages.getMessage('installationKeyFlagDescription')}),
    apexcompileonlypackage : flags.boolean({char: 'a', description: messages.getMessage('apexCompileOnlyPackageFlagDescription')}),
    artifactdir: flags.directory({description: messages.getMessage('artifactDirectoryFlagDescription'), default: 'artifacts'}),
    securitytype : flags.string({description: messages.getMessage('securityTypeFlagDescription'), options: ['AllUsers', 'AdminsOnly'], default: 'AllUsers'}),
    skipifalreadyinstalled: flags.boolean({char: "f",description: messages.getMessage("skipIfAlreadyInstalled")}),
    skiponmissingartifact: flags.boolean({char: 's', description: messages.getMessage('skipOnMissingArtifactFlagDescription'), dependsOn: ['packageinstalledfrom']}),
    upgradetype: flags.string({description: messages.getMessage('upgradeTypeFlagDescription'), options: ['DeprecateOnly', 'Mixed', 'Delete'], default: 'Mixed'}),
    waittime: flags.string({description: messages.getMessage('waitTimeFlagDescription'), default: '120'}),
    publishwaittime: flags.string({description: messages.getMessage('publishWaitTimeFlagDescription'), default: '10'})
  };


  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  public async execute(){
   try {

      const envname: string = this.flags.envname;
      const sfdx_package: string = this.flags.package;
      let skip_on_missing_artifact: boolean = this.flags.skiponmissingartifact;
      const package_installedfrom = this.flags.packageinstalledfrom;

      const installationkey = this.flags.installationkey;
      const apexcompileonlypackage = this.flags.apexcompileonlypackage;
      const artifact_directory: string = this.flags.artifactdir;
      const security_type = this.flags.securitytype;
      const upgrade_type = this.flags.upgradetype;
      const wait_time = this.flags.waittime;
      const publish_wait_time = this.flags.publishwaittime;
      const skipIfAlreadyInstalled = this.flags.skipifalreadyinstalled;
      let packageMetadata;

      let package_version_id;

      if (package_installedfrom) {
        // Figure out the package version id from the artifact

        let package_version_id_file_path;

        package_version_id_file_path = path.join(
          artifact_directory,
          `${sfdx_package}_sfpowerscripts_artifact`,
          `artifact_metadata.json`
        );

        console.log(`Checking for ${sfdx_package} Build Artifact at path ${package_version_id_file_path}`);

        if (!fs.existsSync(package_version_id_file_path) && !skip_on_missing_artifact) {
          throw new Error(
            `Artifact not found at ${package_version_id_file_path}.. Please check the inputs`
          );
        } else if(!fs.existsSync(package_version_id_file_path) && skip_on_missing_artifact) {
          console.log(`Skipping task as artifact is missing, and 'SkipOnMissingArtifact' ${skip_on_missing_artifact}`);
          process.exit(0);
        }



         packageMetadata = JSON.parse(fs
          .readFileSync(package_version_id_file_path)
          .toString());
        console.log("Package Metadata:");
        console.log(packageMetadata);

        package_version_id = packageMetadata.package_version_id;
        console.log(`Using Package Version Id ${package_version_id}`);

      } else {
        package_version_id = this.flags.packageversionid;
      }

      let options = {
        installationkey: installationkey,
        apexcompile: apexcompileonlypackage ? `package` : `all`,
        securitytype: security_type,
        upgradetype: upgrade_type
      };

      let installUnlockedPackageImpl: InstallUnlockedPackageImpl = new InstallUnlockedPackageImpl(
        package_version_id,
        envname,
        options,
        wait_time,
        publish_wait_time,
        skipIfAlreadyInstalled,
        packageMetadata
      );

      await installUnlockedPackageImpl.exec();

    } catch(err) {
      console.log(err);
      process.exit(1);
    }
  }
}
