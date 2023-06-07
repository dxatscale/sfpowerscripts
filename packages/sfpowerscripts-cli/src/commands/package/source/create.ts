import { flags } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { COLOR_SUCCESS, ConsoleLogger } from '@dxatscale/sfp-logger';
import PackageCreateCommand from '../../../PackageCreateCommand';
import SfpPackage, { PackageType } from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackage';
import SfpPackageBuilder from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackageBuilder';

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

    protected static flagsConfig = {
        package: flags.string({
            required: true,
            char: 'n',
            description: messages.getMessage('packageFlagDescription'),
        }),
        versionnumber: flags.string({
            required: true,
            char: 'v',
            description: messages.getMessage('versionNumberFlagDescription'),
        }),
        artifactdir: flags.directory({
            description: messages.getMessage('artifactDirectoryFlagDescription'),
            default: 'artifacts',
        }),
        diffcheck: flags.boolean({ description: messages.getMessage('diffCheckFlagDescription') }),
        branch: flags.string({
            description: messages.getMessage('branchFlagDescription'),
        }),
        gittag: flags.boolean({ description: messages.getMessage('gitTagFlagDescription') }),
        repourl: flags.string({ char: 'r', description: messages.getMessage('repoUrlFlagDescription') }),
        refname: flags.string({ description: messages.getMessage('refNameFlagDescription') }),
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
