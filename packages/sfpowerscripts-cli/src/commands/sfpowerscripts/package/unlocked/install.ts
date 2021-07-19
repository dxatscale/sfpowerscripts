import { flags } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import InstallPackageCommand from '../../../../InstallPackageCommand';
import { PackageInstallationStatus } from '@dxatscale/sfpowerscripts.core/lib/package/PackageInstallationResult';
import InstallUnlockedPackageImpl from '@dxatscale/sfpowerscripts.core/lib/sfpcommands/package/InstallUnlockedPackageImpl';
const fs = require("fs");

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'install_unlocked_package');

export default class InstallUnlockedPackage extends InstallPackageCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:package:unlocked:install -n packagename -u sandboxalias -i`
  ];


  protected static flagsConfig = {
    package: flags.string({char: 'n', description: messages.getMessage('packageFlagDescription')}),
    targetorg: flags.string({char: 'u', description: messages.getMessage('targetOrgFlagDescription')}),
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
    publishwaittime: flags.string({description: messages.getMessage('publishWaitTimeFlagDescription'), default: '10'}),
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


  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  public async install(){
   try {

      const targetOrg: string = this.flags.targetorg;
      const package_installedfrom = this.flags.packageinstalledfrom;
      const installationkey = this.flags.installationkey;
      const apexcompileonlypackage = this.flags.apexcompileonlypackage;
      const security_type = this.flags.securitytype;
      const upgrade_type = this.flags.upgradetype;
      const wait_time = this.flags.waittime;
      const publish_wait_time = this.flags.publishwaittime;
      const skipIfAlreadyInstalled = this.flags.skipifalreadyinstalled;
      let packageMetadata;
      let sourceDirectory;
      let package_version_id;

      if (package_installedfrom) {
        // Figure out the package version id from the artifact

        let package_version_id_file_path =this.artifactFilePaths.packageMetadataFilePath;
        sourceDirectory = this.artifactFilePaths.sourceDirectoryPath;


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
        targetOrg,
        options,
        wait_time,
        publish_wait_time,
        skipIfAlreadyInstalled,
        packageMetadata,
        sourceDirectory
      );

      let result = await installUnlockedPackageImpl.exec();

      if (result.result === PackageInstallationStatus.Failed) {
        throw new Error(result.message);
      } 
    } catch(err) {
      console.log(err);
      process.exitCode=1;
    }
  }
}
