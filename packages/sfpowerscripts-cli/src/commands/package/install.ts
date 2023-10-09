import { Messages } from '@salesforce/core';
import InstallPackageCommand from '../../InstallPackageCommand';
import { PackageInstallationStatus } from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/PackageInstallationResult';
import SFPLogger, { COLOR_HEADER, COLOR_KEY_MESSAGE, ConsoleLogger, LoggerLevel } from '@dxatscale/sfp-logger';
import { SfpPackageInstallationOptions } from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/InstallPackage';
import SfpPackageInstaller from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackageInstaller';
import { Flags } from '@oclif/core';
import { loglevel, requiredUserNameFlag } from '../../flags/sfdxflags';
import { PackageType } from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackage';


Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'install_package');

export default class Install extends InstallPackageCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = [`$ sfp package:install -n packagename -u sandboxalias -i`];

  public static flags = {
    package: Flags.string({
      char: 'n',
      description: messages.getMessage('packageFlagDescription'),
    }),
    targetorg: requiredUserNameFlag,
    apexcompileonlypackage: Flags.boolean({
      char: 'a',
      description: messages.getMessage('apexCompileOnlyPackageFlagDescription'),
    }),
    artifactdir: Flags.directory({
      description: messages.getMessage('artifactDirectoryFlagDescription'),
      default: 'artifacts',
    }),
    securitytype: Flags.string({
      description: messages.getMessage('securityTypeFlagDescription'),
      options: ['full', 'none'],
      default: 'none',
    }),
    skipifalreadyinstalled: Flags.boolean({
      char: 'f',
      description: messages.getMessage('skipIfAlreadyInstalled'),
    }),
    upgradetype: Flags.string({
      description: messages.getMessage('upgradeTypeFlagDescription'),
      options: ['delete-only', 'deprecate-only', 'mixed-mode'],
      default: 'mixed-mode',
    }),
    optimizedeployment: Flags.boolean({
      char: 'o',
      description: messages.getMessage('optimizedeployment'),
      default: false,
      required: false,
  }),
    skiptesting: Flags.boolean({
      char: 't',
      description: messages.getMessage('skiptesting'),
      default: false,
      required: false,
    }),
    waittime: Flags.string({
      description: messages.getMessage('waitTimeFlagDescription'),
      default: '120',
    }),
    publishwaittime: Flags.string({
      description: messages.getMessage('publishWaitTimeFlagDescription'),
      default: '10',
    }),
    loglevel
  };

  protected static requiresUsername = true;
  protected static requiresDevhubUsername = false;

  public async install() {
    try {
      const installationkey = this.flags.installationkey;
      const apexcompileonlypackage = this.flags.apexcompileonlypackage;
      const security_type = this.flags.securitytype;
      const upgrade_type = this.flags.upgradetype;
      const waitTime = this.flags.waittime;
      const publishWaitTime = this.flags.publishwaittime;
      const skipIfAlreadyInstalled = this.flags.skipifalreadyinstalled;
      const optimizeDeployment: boolean = this.flags.optimizedeployment;
      const skipTesting: boolean = this.flags.skiptesting;

     
      SFPLogger.log(COLOR_HEADER(`command: ${COLOR_KEY_MESSAGE(`install`)}`));
      SFPLogger.log(COLOR_HEADER(`Package Name: ${this.sfpPackage.packageName}`));
      SFPLogger.log(COLOR_HEADER(`Package Type: ${this.sfpPackage.packageType}`));
      SFPLogger.log(COLOR_HEADER(`Skip Packages If Already Installed: ${this.flags.skipifalreadyinstalled?`true`:`false`}`));
      SFPLogger.log(COLOR_HEADER(`Artifact Directory: ${this.flags.artifactdir}`));
      SFPLogger.log(COLOR_HEADER(`Target Environment: ${this.flags.targetorg}`));


      if(this.sfpPackage.packageType == PackageType.Unlocked)
      {
      
        SFPLogger.log(COLOR_HEADER(`Security Type: ${this.flags.securitytype}`));
        SFPLogger.log(COLOR_HEADER(`Upgrade Type: ${this.flags.upgradetype}`));
        SFPLogger.log(COLOR_HEADER(`Apex Compile Mode: ${ apexcompileonlypackage ? `package` : `all`}`));
      }
      else if(this.sfpPackage.packageType == PackageType.Source)
      {
        SFPLogger.log(COLOR_HEADER(`Optimize Deployment: ${this.flags.optimizedeployment}`));
        SFPLogger.log(COLOR_HEADER(`Skip Testing: ${this.flags.skiptesting}`));
      }
    
      
      SFPLogger.printHeaderLine('',COLOR_HEADER,LoggerLevel.INFO);


      let options: SfpPackageInstallationOptions = {
        installationkey: installationkey,
        apexcompile: apexcompileonlypackage ? `package` : `all`,
        securitytype: security_type,
        optimizeDeployment: optimizeDeployment,
        skipTesting: skipTesting,
        upgradetype: upgrade_type,
        waitTime: waitTime,
        publishWaitTime: publishWaitTime,
        disableArtifactCommit: false,
        skipIfPackageInstalled: skipIfAlreadyInstalled,
        apiVersion: this.sfpPackage.apiVersion
      };

      let result = await SfpPackageInstaller.installPackage(
        new ConsoleLogger(),
        this.sfpPackage,
        this.sfpOrg,
        options
      );

      if (result.result === PackageInstallationStatus.Failed) {
        throw new Error(result.message);
      }
    } catch (err) {
      console.log(err);
      process.exitCode = 1;
    }
  }
}
