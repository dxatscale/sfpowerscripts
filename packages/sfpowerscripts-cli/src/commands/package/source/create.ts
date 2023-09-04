import { Messages } from '@salesforce/core';
import { COLOR_SUCCESS, ConsoleLogger } from '@dxatscale/sfp-logger';
import PackageCreateCommand from '../../../PackageCreateCommand';
import SfpPackage, { PackageType } from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackage';
import SfpPackageBuilder from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackageBuilder';
import { Flags } from '@oclif/core';
import { loglevel } from '../../../flags/sfdxflags';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'create_source_package');

export default class CreateSourcePackage extends PackageCreateCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfpowerscripts package:source:create -n mypackage -v <version>`,
        `$ sfpowerscripts package:source:create -n <mypackage> -v <version> --diffcheck --gittag`,
        `Output variable:`,
        `sfpowerscripts_artifact_metadata_directory`,
        `<refname>_sfpowerscripts_artifact_metadata_directory`,
        `sfpowerscripts_artifact_directory`,
        `<refname>_sfpowerscripts_artifact_directory`,
        `sfpowerscripts_package_version_number`,
        `<refname>_sfpowerscripts_package_version_number`,
    ];

    protected static requiresUsername = false;
    protected static requiresDevhubUsername = false;
    protected static requiresProject = true;

    public static flags = {
        package: Flags.string({
            required: true,
            char: 'n',
            description: messages.getMessage('packageFlagDescription'),
        }),
        versionnumber: Flags.string({
            required: true,
            char: 'v',
            description: messages.getMessage('versionNumberFlagDescription'),
        }),
        artifactdir: Flags.directory({
            description: messages.getMessage('artifactDirectoryFlagDescription'),
            default: 'artifacts',
        }),
        diffcheck: Flags.boolean({ description: messages.getMessage('diffCheckFlagDescription') }),
        branch: Flags.string({
            description: messages.getMessage('branchFlagDescription'),
        }),
        gittag: Flags.boolean({ description: messages.getMessage('gitTagFlagDescription') }),
        repourl: Flags.string({ char: 'r', description: messages.getMessage('repoUrlFlagDescription') }),
        refname: Flags.string({ description: messages.getMessage('refNameFlagDescription') }),
        loglevel
    };

    protected async create(): Promise<SfpPackage> {
        let sfpPackage = await SfpPackageBuilder.buildPackageFromProjectDirectory(
            new ConsoleLogger(),
            null,
            this.sfdxPackage,
            {
                overridePackageTypeWith: PackageType.Source,
                packageVersionNumber: this.versionNumber,
                sourceVersion: this.commitId,
                repositoryUrl: this.repositoryURL,
                branch: this.branch,
            }
        );

        console.log(COLOR_SUCCESS(`Created source package ${sfpPackage.packageName}`));

        return sfpPackage;
    }

    protected getConfigFilePath(): string {
        return null;
    }
}
