import SfpCommand from './SfpCommand';
import { Messages } from '@salesforce/core';
import ArtifactFetcher, { Artifact } from './core/artifacts/ArtifactFetcher';
import * as rimraf from 'rimraf';
import SfpPackage from './core/package/SfpPackage';
import { ConsoleLogger } from '@flxblio/sfp-logger';
import SfpPackageBuilder from './core/package/SfpPackageBuilder';
import SFPOrg from './core/org/SFPOrg';
import { Flags } from '@oclif/core';
import { requiredUserNameFlag } from './flags/sfdxflags';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@flxblio/sfp', 'install_package_command');

/**
 * Base class providing common functionality for package installation
 *
 * @extends SfpCommand
 */
export default abstract class InstallPackageCommand extends SfpCommand {
    protected sfpPackage: SfpPackage;
    protected sfpOrg: SFPOrg;
    /**
     * Flags that are common/required on all package installation commands
     */
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
