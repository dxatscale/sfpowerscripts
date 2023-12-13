import { Messages } from '@salesforce/core';
import { COLOR_SUCCESS, ConsoleLogger } from '@flxblio/sfp-logger';
import PackageCreateCommand from '../../../PackageCreateCommand';
import SfpPackage, { PackageType } from '../../../core/package/SfpPackage';
import SfpPackageBuilder from '../../../core/package/SfpPackageBuilder';
import { Flags } from '@oclif/core';
import { loglevel } from '../../../flags/sfdxflags';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@flxblio/sfp', 'create_source_package');

export default class CreateSourcePackage extends PackageCreateCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfp package:source:create -n mypackage -v <version>`,
        `$ sfp package:source:create -n <mypackage> -v <version> --diffcheck --gittag`
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
