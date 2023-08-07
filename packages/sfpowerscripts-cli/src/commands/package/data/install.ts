import { Messages } from '@salesforce/core';
import InstallPackageCommand from '../../../InstallPackageCommand';
import { PackageInstallationStatus } from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/PackageInstallationResult';
import { ConsoleLogger } from '@dxatscale/sfp-logger';
import SfpPackageInstaller from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackageInstaller';
import { SfpPackageInstallationOptions } from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/InstallPackage';
import { Flags } from '@oclif/core';
import { loglevel, requiredUserNameFlag } from '../../../flags/sfdxflags';


// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'install_data_package');

export default class InstallDataPackage extends InstallPackageCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [`$ sfpowerscripts package:data:install -n mypackage -u <org>`];

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
