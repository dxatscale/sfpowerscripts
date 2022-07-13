import { flags } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import ProjectConfig from '@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig';
import { COLOR_SUCCESS, ConsoleLogger } from '@dxatscale/sfp-logger';
import PackageCreateCommand from '../../../../PackageCreateCommand';
import SfpPackage, { PackageType } from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackage';
import SfpPackageBuilder from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackageBuilder';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'create_data_package');

export default class CreateDataPackage extends PackageCreateCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfdx sfpowerscripts:package:data:create -n mypackage -v <version>`,
        `$ sfdx sfpowerscripts:package:data:create -n <mypackage> -v <version> --diffcheck --gittag`,
        `Output variable:`,
        `sfpowerscripts_artifact_directory`,
        `<refname>_sfpowerscripts_artifact_directory`,
        `sfpowerscripts_package_version_number`,
        `<refname>_sfpowerscripts_package_version_number`,
    ];

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
        diffcheck: flags.boolean({
            description: messages.getMessage('diffCheckFlagDescription'),
        }),
        branch: flags.string({
            description: messages.getMessage('branchFlagDescription'),
        }),
        gittag: flags.boolean({
            description: messages.getMessage('gitTagFlagDescription'),
        }),
        repourl: flags.string({
            char: 'r',
            description: messages.getMessage('repoUrlFlagDescription'),
        }),
        refname: flags.string({
            description: messages.getMessage('refNameFlagDescription'),
        }),
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
        let packageDescriptor = ProjectConfig.getSFDXPackageDescriptor(null, this.sfdxPackage);
        if (packageDescriptor.type?.toLowerCase() !== PackageType.Data) {
            throw new Error("Data packages must have 'type' property of PackageType.Data defined in sfdx-project.json");
        }

        let sfpPackage = await SfpPackageBuilder.buildPackageFromProjectDirectory(
            new ConsoleLogger(),
            null,
            this.sfdxPackage,
            {
                packageVersionNumber: this.versionNumber,
                sourceVersion: this.commitId,
                repositoryUrl: this.repositoryURL,
                branch: this.branch,
            }
        );

        console.log(COLOR_SUCCESS(`Created data package ${sfpPackage.packageName}`));
        return sfpPackage;
    }

    protected getConfigFilePath(): string {
        return null;
    }
}
