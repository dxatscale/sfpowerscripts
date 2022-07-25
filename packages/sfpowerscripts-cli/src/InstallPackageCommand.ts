import SfpowerscriptsCommand from './SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import { flags } from '@salesforce/command';
import ArtifactFetcher, { Artifact } from '@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFetcher';
import * as rimraf from 'rimraf';
import SfpPackage from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackage';
import { ConsoleLogger } from '@dxatscale/sfp-logger';
import SfpPackageBuilder from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackageBuilder';
import SFPOrg from '@dxatscale/sfpowerscripts.core/lib/org/SFPOrg';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'install_package_command');

/**
 * Base class providing common functionality for package installation
 *
 * @extends SfpowerscriptsCommand
 */
export default abstract class InstallPackageCommand extends SfpowerscriptsCommand {
    protected sfpPackage: SfpPackage;
    protected sfpOrg: SFPOrg;
    /**
     * Flags that are common/required on all package installation commands
     */
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
    };

    protected artifact: Artifact;

    /**
     * Procedures unique to the type of package installation
     */
    abstract install(): Promise<any>;

    /**
     * Entry point for package installation commands
     *
     */
    async execute(): Promise<any> {
        await this.preInstall();

        await this.install();

        this.postInstall();
    }

    /**
     * Procedures common to all install commands, and to be run BEFORE
     * the primary install
     */
    private async preInstall(): Promise<void> {
        let artifacts = ArtifactFetcher.fetchArtifacts(this.flags.artifactdir, this.flags.package, null);
        if (artifacts.length === 0) {
            if (!this.flags.skiponmissingartifact) {
                throw new Error(
                    `${this.flags.package} artifact not found at ${this.flags.artifactdir}...Please check the inputs`
                );
            } else if (this.flags.skiponmissingartifact) {
                console.log(
                    `Skipping task as artifact is missing, and 'SkipOnMissingArtifact' ${this.flags.skiponmissingartifact}`
                );
                process.exit(0);
            }
        } else this.artifact = artifacts[0];

        this.sfpPackage = await SfpPackageBuilder.buildPackageFromArtifact(this.artifact, new ConsoleLogger());

        //Create SfP Org
        this.sfpOrg = await SFPOrg.create({aliasOrUsername:this.flags.targetorg});
    }

    /**
     * Procedures common to all install commands, and to be run AFTER
     * the primary install
     */
    private postInstall(): void {
        // Delete temp directory containing unzipped artifacts
        rimraf.sync('.sfpowerscripts/unzippedArtifacts');
    }
}
