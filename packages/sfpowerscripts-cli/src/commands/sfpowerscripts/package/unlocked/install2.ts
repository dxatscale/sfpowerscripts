import { flags } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import InstallPackageCommand from '../../../../InstallPackageCommand';
import { PackageInstallationStatus } from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/PackageInstallationResult';
import SFPLogger, { ConsoleLogger } from '@dxatscale/sfp-logger';
import { SfpPackageInstallationOptions } from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/InstallPackage';
import SfpPackageInstaller from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackageInstaller';
import SfpowerscriptsCommand from '../../../../SfpowerscriptsCommand';
import InstallUnlockedPackageCollection from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/InstallUnlockedPackageCollection';
import SFPOrg from '@dxatscale/sfpowerscripts.core/lib/org/SFPOrg';


// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'install_unlocked_package');

export default class InstallUnlockedPackage2 extends SfpowerscriptsCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [`$ sfdx sfpowerscripts:package:unlocked:install -n packagename -u sandboxalias -i`];

    protected static flagsConfig = {
        package: flags.string({
            char: 'n',
            description: messages.getMessage('packageFlagDescription'),
        }),
        targetorg: flags.string({
            char: 'u',
            description: messages.getMessage('targetOrgFlagDescription'),
        }),
    };

    protected static requiresUsername = false;
    protected static requiresDevhubUsername = false;
    public async execute() {

        SFPLogger.log(
            `Installing sfpowerscripts_artifact package to the ${this.flags.targetorg}`,
        );


        let sfpOrg = await SFPOrg.create({aliasOrUsername:this.flags.targetorg});

        let packageCollectionInstaller = new InstallUnlockedPackageCollection(
            sfpOrg,
            new ConsoleLogger()
        );

        
        //Install sfpowerscripts artifact package
        await packageCollectionInstaller.install(
            [
                {
                    name: 'sfpowerscripts_artifact2',
                    subscriberPackageVersionId: '04t1P000000ka9mQAA'
                },
            ],
            true
        );

    }

}
