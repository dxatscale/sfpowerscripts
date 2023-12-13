import { Messages } from '@salesforce/core';
import InstallPackageCommand from '../../../InstallPackageCommand';
import { PackageInstallationStatus } from '../../../core/package/packageInstallers/PackageInstallationResult';
import SFPLogger, { ConsoleLogger, LoggerLevel } from '@flxblio/sfp-logger';
import SfpPackageInstaller from '../../../core/package/SfpPackageInstaller';
import { SfpPackageInstallationOptions } from '../../../core/package/packageInstallers/InstallPackage';
import { Flags } from '@oclif/core';
import { loglevel, requiredUserNameFlag } from '../../../flags/sfdxflags';


// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@flxblio/sfp', 'install_data_package');

export default class InstallDataPackage extends InstallPackageCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [`$ sfp package:data:install -n mypackage -u <org>`];

    public static deprecated:boolean = true;

    public static flags = {
        package: Flags.string({
            char: 'n',
            description: messages.getMessage('packageFlagDescription'),
            required: true,
        }),
        targetorg: requiredUserNameFlag,
        artifactdir: Flags.directory({
            description: messages.getMessage('artifactDirectoryFlagDescription'),
            default: 'artifacts',
        }),
        skiponmissingartifact: Flags.boolean({
            char: 's',
            description: messages.getMessage('skipOnMissingArtifactFlagDescription'),
        }),
        skipifalreadyinstalled: Flags.boolean({ description: messages.getMessage('skipIfAlreadyInstalled') }),
        loglevel
    };

    protected static requiresUsername = false;
    protected static requiresDevhubUsername = false;

    public async install() {
        try {
          
            SFPLogger.log(`This command is now deprecated, please proceed to use sfp package:install instead`,LoggerLevel.WARN)

            
            const skipIfAlreadyInstalled = this.flags.skipifalreadyinstalled;
            let options: SfpPackageInstallationOptions = {
                skipIfPackageInstalled: skipIfAlreadyInstalled
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
