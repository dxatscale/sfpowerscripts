import ArtifactGenerator from './core/artifacts/generators/ArtifactGenerator';
import { COLOR_HEADER, COLOR_KEY_MESSAGE, ConsoleLogger } from '@flxblio/sfp-logger';
import PackageDiffImpl from './core/package/diff/PackageDiffImpl';
import { Messages } from '@salesforce/core';
import { EOL } from 'os';
import SfpCommand from './SfpCommand';
import SfpPackage, { PackageType } from './core/package/SfpPackage';
import getFormattedTime from './core/utils/GetFormattedTime';
const fs = require('fs-extra');
import Git from './core/git/Git';
import { Flags } from '@oclif/core';
import { loglevel } from './flags/sfdxflags';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@flxblio/sfp', 'create-package');

export default abstract class PackageCreateCommand extends SfpCommand {
    protected static requiresUsername = false;
    protected static requiresDevhubUsername = false;
    protected static requiresProject = true;

    public static flags = {
        package: Flags.string({
            required: true,
            char: 'n',
            description: messages.getMessage('packageFlagDescription'),
        }),
        diffcheck: Flags.boolean({
            description: messages.getMessage('diffCheckFlagDescription'),
        }),
        gittag: Flags.boolean({
            description: messages.getMessage('gitTagFlagDescription'),
        }),
        repourl: Flags.string({
            char: 'r',
            description: messages.getMessage('repoUrlFlagDescription'),
        }),
        versionnumber: Flags.string({
            description: messages.getMessage('versionNumberFlagDescription'),
        }),
        artifactdir: Flags.directory({
            description: messages.getMessage('artifactDirectoryFlagDescription'),
            default: 'artifacts',
        }),
        branch: Flags.string({
            description: messages.getMessage('branchFlagDescription'),
        }),
        refname: Flags.string({
            description: messages.getMessage('refNameFlagDescription'),
        }),
        loglevel
    };

    protected sfdxPackage: string;
    protected versionNumber: string;
    protected artifactDirectory: string;
    protected refname: string;
    protected branch: string;
    protected commitId: string;
    protected repositoryURL: string;

    /**
     * Entry point for package installation commands
     *
     */
    async execute(): Promise<any> {
        let isToCreatePackage = await this.preCreate();
        if (isToCreatePackage) {
            try {
                let packageMetadata = await this.create();
                await this.postCreate(packageMetadata);
            } catch (err) {
                console.log(err);
                process.exit(1);
            }
        }
    }

    private async preCreate(): Promise<boolean> {
        this.sfdxPackage = this.flags.package;
        this.versionNumber = this.flags.versionnumber;
        this.artifactDirectory = this.flags.artifactdir;
        this.refname = this.flags.refname;
        this.branch = this.flags.branch;

        if (this.hubOrg) await this.hubOrg.refreshAuth();

        let isToRunBuild;

        if (this.flags.diffcheck) {
            let packageDiffImpl = new PackageDiffImpl(new ConsoleLogger(), this.sfdxPackage, null);

            let isToRunBuild = (await packageDiffImpl.exec()).isToBeBuilt;

            if (isToRunBuild) console.log(`Detected changes to ${this.sfdxPackage} package...proceeding\n`);
            else console.log(`No changes detected for ${this.sfdxPackage} package...skipping\n`);
        } else isToRunBuild = true;

        if (isToRunBuild) {
            let git = await Git.initiateRepo(new ConsoleLogger());
            this.repositoryURL = await git.getRemoteOriginUrl(this.flags.repourl);
            this.commitId = await git.getHeadCommit();
        }
        return isToRunBuild;
    }

    protected abstract getConfigFilePath(): string;

    protected abstract create(): Promise<SfpPackage>;

    private async postCreate(sfpPackage: SfpPackage) {
        this.printPackageDetails(sfpPackage);

        if (this.flags.gittag) {
           
            let git = await Git.initiateRepo(new ConsoleLogger());
            let tagname = `${this.sfdxPackage}_v${sfpPackage.package_version_number}`;
            await git.addAnnotatedTag(tagname, `${sfpPackage.packageName} sfp package ${sfpPackage.package_version_number}`)

            sfpPackage.tag = tagname;
        }

        //Generate Artifact
        let artifactFilepath: string = await ArtifactGenerator.generateArtifact(
            sfpPackage,
            process.cwd(),
            this.artifactDirectory
        );

        this.generateEnvironmentVariables(artifactFilepath, sfpPackage);
    }

    private generateEnvironmentVariables(artifactFilepath: string, sfpPackage: SfpPackage) {
        let prefix = 'sfp';
        if (this.refname != null) prefix = `${this.refname}_${prefix}`;

        console.log('\nOutput variables:');

        fs.writeFileSync('.env', `${prefix}_artifact_directory=${artifactFilepath}\n`, { flag: 'a' });
        console.log(`${prefix}_artifact_directory=${artifactFilepath}`);
        fs.writeFileSync('.env', `${prefix}_package_version_number=${sfpPackage.package_version_number}\n`, {
            flag: 'a',
        });
        console.log(`${prefix}_package_version_number=${sfpPackage.package_version_number}`);

        if (sfpPackage.package_version_id) {
            fs.writeFileSync('.env', `${prefix}_package_version_id=${sfpPackage.package_version_id}\n`, {
                flag: 'a',
            });
            console.log(`${prefix}_package_version_id=${sfpPackage.package_version_id}`);
        }
    }

    protected printPackageDetails(sfpPackage: SfpPackage) {
        console.log(
            COLOR_HEADER(
                `${EOL}${sfpPackage.packageName} package created in ${getFormattedTime(
                    sfpPackage.creation_details.creation_time
                )}`
            )
        );
        console.log(COLOR_HEADER(`-- Package Details:--`));
        console.log(
            COLOR_HEADER(`-- Package Version Number:        `),
            COLOR_KEY_MESSAGE(sfpPackage.package_version_number)
        );

        if (sfpPackage.package_type !== PackageType.Data) {
            if (sfpPackage.package_type == PackageType.Unlocked) {
                if (sfpPackage.package_version_id)
                    console.log(
                        COLOR_HEADER(`-- Package Version Id:             `),
                        COLOR_KEY_MESSAGE(sfpPackage.package_version_id)
                    );
                if (sfpPackage.test_coverage)
                    console.log(
                        COLOR_HEADER(`-- Package Test Coverage:          `),
                        COLOR_KEY_MESSAGE(sfpPackage.test_coverage)
                    );
                if (sfpPackage.has_passed_coverage_check)
                    console.log(
                        COLOR_HEADER(`-- Package Coverage Check Passed:  `),
                        COLOR_KEY_MESSAGE(sfpPackage.has_passed_coverage_check)
                    );
            }

            console.log(
                COLOR_HEADER(`-- Apex In Package:             `),
                COLOR_KEY_MESSAGE(sfpPackage.isApexFound ? 'Yes' : 'No')
            );
            console.log(
                COLOR_HEADER(`-- Profiles In Package:         `),
                COLOR_KEY_MESSAGE(sfpPackage.isProfilesFound ? 'Yes' : 'No')
            );
            console.log(COLOR_HEADER(`-- Metadata Count:         `), COLOR_KEY_MESSAGE(sfpPackage.metadataCount));
        }
    }
}
