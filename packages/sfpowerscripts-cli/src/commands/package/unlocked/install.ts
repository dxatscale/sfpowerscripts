import { Messages } from '@salesforce/core';
import InstallPackageCommand from '../../../InstallPackageCommand';
import { PackageInstallationStatus } from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/PackageInstallationResult';
import { ConsoleLogger } from '@dxatscale/sfp-logger';
import { SfpPackageInstallationOptions } from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/InstallPackage';
import SfpPackageInstaller from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackageInstaller';
import { Flags } from '@oclif/core';
import { loglevel, requiredUserNameFlag } from '../../../flags/sfdxflags';


// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'install_unlocked_package');

export default class InstallUnlockedPackage extends InstallPackageCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [`$ sfpowerscripts package:unlocked:install -n packagename -u sandboxalias -i`];

    public static flags = {
        package: Flags.string({
            char: 'n',
            description: messages.getMessage('packageFlagDescription'),
        }),
        targetorg: requiredUserNameFlag,
        installationkey: Flags.string({
            char: 'k',
            description: messages.getMessage('installationKeyFlagDescription'),
        }),
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
            options: ['AllUsers', 'AdminsOnly'],
            default: 'AllUsers',
        }),
        skipifalreadyinstalled: Flags.boolean({
            char: 'f',
            description: messages.getMessage('skipIfAlreadyInstalled'),
        }),
        skiponmissingartifact: Flags.boolean({
            char: 's',
            description: messages.getMessage('skipOnMissingArtifactFlagDescription'),
            dependsOn: ['packageinstalledfrom'],
        }),
        upgradetype: Flags.string({
            description: messages.getMessage('upgradeTypeFlagDescription'),
            options: ['DeprecateOnly', 'Mixed', 'Delete'],
            default: 'Mixed',
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

            let options: SfpPackageInstallationOptions = {
                installationkey: installationkey,
                apexcompile: apexcompileonlypackage ? `package` : `all`,
                securitytype: security_type,
                upgradetype: upgrade_type,
                waitTime: waitTime,
                publishWaitTime: publishWaitTime,
                disableArtifactCommit: false,
                skipIfPackageInstalled: skipIfAlreadyInstalled,
                apiVersion: this.sfpPackage.apiVersion || this.sfpPackage.payload.Package.version, // Use package.xml version for backwards compat with old artifacts
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
