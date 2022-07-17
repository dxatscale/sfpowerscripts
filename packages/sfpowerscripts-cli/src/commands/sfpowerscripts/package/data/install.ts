import { flags } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import InstallPackageCommand from '../../../../InstallPackageCommand';
import { PackageInstallationStatus } from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/PackageInstallationResult';
import { ConsoleLogger } from '@dxatscale/sfp-logger';
import SfpPackageInstaller from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackageInstaller';
import { SfpPackageInstallationOptions } from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/InstallPackage';


// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'install_data_package');

export default class InstallDataPackage extends InstallPackageCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [`$ sfdx sfpowerscripts:package:data:install -n mypackage -u <org>`];

    protected static flagsConfig = {
        package: flags.string({
            char: 'n',
            description: messages.getMessage('packageFlagDescription'),
            required: true,
        }),
        targetorg: flags.string({
            char: 'u',
            description: messages.getMessage('targetOrgFlagDescription'),
            required: true,
        }),
        artifactdir: flags.directory({
            description: messages.getMessage('artifactDirectoryFlagDescription'),
            default: 'artifacts',
        }),
        skiponmissingartifact: flags.boolean({
            char: 's',
            description: messages.getMessage('skipOnMissingArtifactFlagDescription'),
        }),
        skipifalreadyinstalled: flags.boolean({ description: messages.getMessage('skipIfAlreadyInstalled') }),
        loglevel: flags.enum({
            description: 'logging level for this command invocation',
            default: 'info',
            required: false,
            options: [
                'trace',
                'debug',
                'info',
                'warn',
                'error',
                'fatal',
                'TRACE',
                'DEBUG',
                'INFO',
                'WARN',
                'ERROR',
                'FATAL',
            ],
        }),
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
