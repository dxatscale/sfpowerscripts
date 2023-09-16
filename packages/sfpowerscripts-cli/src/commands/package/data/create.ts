import { Messages } from '@salesforce/core';
import ProjectConfig from '@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig';
import { COLOR_SUCCESS, ConsoleLogger } from '@dxatscale/sfp-logger';
import PackageCreateCommand from '../../../PackageCreateCommand';
import SfpPackage, { PackageType } from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackage';
import SfpPackageBuilder from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackageBuilder';
import { Flags } from '@oclif/core';
import { loglevel } from '../../../flags/sfdxflags';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'create_data_package');

export default class CreateDataPackage extends PackageCreateCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfp package:data:create -n mypackage -v <version>`,
        `$ sfp package:data:create -n <mypackage> -v <version> --diffcheck --gittag`,
    ];

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
        diffcheck: Flags.boolean({
            description: messages.getMessage('diffCheckFlagDescription'),
        }),
        branch: Flags.string({
            description: messages.getMessage('branchFlagDescription'),
        }),
        gittag: Flags.boolean({
            description: messages.getMessage('gitTagFlagDescription'),
        }),
        repourl: Flags.string({
            char: 'r',
            description: messages.getMessage('repoUrlFlagDescription'),
        }),
        refname: Flags.string({
            description: messages.getMessage('refNameFlagDescription'),
        }),
        loglevel
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
