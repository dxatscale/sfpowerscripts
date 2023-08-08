import { Messages } from '@salesforce/core';
import InstallPackageCommand from '../../../InstallPackageCommand';
import * as fs from 'fs-extra';
import { PackageInstallationStatus } from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/PackageInstallationResult';
import { ConsoleLogger } from '@dxatscale/sfp-logger';
import { DeploymentType } from '@dxatscale/sfpowerscripts.core/lib/deployers/DeploymentExecutor';
import { SfpPackageInstallationOptions } from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/InstallPackage';
import SfpPackageInstaller from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackageInstaller';
import { loglevel, requiredUserNameFlag } from '../../../flags/sfdxflags';
import { Flags } from '@oclif/core';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'install_source_package');

export default class InstallSourcePackage extends InstallPackageCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [`$ sfpowerscripts package:source:install -n mypackage -u <org>`];

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
        skipifalreadyinstalled: Flags.boolean({
            description: messages.getMessage('skipIfAlreadyInstalled'),
        }),
        skiponmissingartifact: Flags.boolean({
            char: 's',
            description: messages.getMessage('skipOnMissingArtifactFlagDescription'),
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
        refname: Flags.string({
            description: messages.getMessage('refNameFlagDescription'),
        }),
        loglevel
    };

    public async install(): Promise<any> {

        const sfdx_package: string = this.flags.package;
        const optimizeDeployment: boolean = this.flags.optimizedeployment;
        const skipTesting: boolean = this.flags.skiptesting;
        const wait_time: string = this.flags.waittime;
        const skipIfAlreadyInstalled = this.flags.skipifalreadyinstalled;

        console.log('sfpowerscripts.Install Source Package To Org');

        try {
            let options: SfpPackageInstallationOptions = {
                optimizeDeployment: optimizeDeployment,
                skipTesting: skipTesting,
                waitTime: wait_time,
                deploymentType: DeploymentType.MDAPI_DEPLOY,
                apiVersion: this.sfpPackage.apiVersion || this.sfpPackage.payload.Package.version, // Use package.xml version for backwards compat with old artifacts
                disableArtifactCommit: false,
                skipIfPackageInstalled : skipIfAlreadyInstalled
            };


            let result = await SfpPackageInstaller.installPackage(
               new ConsoleLogger(),
                this.sfpPackage,
                this.sfpOrg,
                options
            );


            if (result.result == PackageInstallationStatus.Failed) {
                throw new Error(result.message);
            } else {
                console.log(`Succesfully Installed source package ${sfdx_package}`);

                console.log('\n\nOutput variables:');
                if (result.deploy_id) {
                    if (this.flags.refname) {
                        fs.writeFileSync(
                            '.env',
                            `${this.flags.refname}_sfpowerscripts_installsourcepackage_deployment_id=${result.deploy_id}\n`,
                            { flag: 'a' }
                        );
                        console.log(
                            `${this.flags.refname}_sfpowerscripts_installsourcepackage_deployment_id=${result.deploy_id}`
                        );
                    } else {
                        fs.writeFileSync(
                            '.env',
                            `sfpowerscripts_installsourcepackage_deployment_id=${result.deploy_id}\n`,
                            { flag: 'a' }
                        );
                        console.log(`sfpowerscripts_installsourcepackage_deployment_id=${result.deploy_id}`);
                    }
                }
            }
        } catch (error) {
            console.log(error.message);
            process.exitCode = 1;
        }
    }
}
