import { Messages } from '@salesforce/core';
import PackageCreateCommand from '../../../PackageCreateCommand';
import { COLOR_SUCCESS, ConsoleLogger } from '@dxatscale/sfp-logger';
import SfpPackage from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackage';
import SfpPackageBuilder from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackageBuilder';
import { loglevel, requiredDevHubFlag } from '../../../flags/sfdxflags';
import { Flags } from '@oclif/core';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'create_unlocked_package');

export default class CreateUnlockedPackage extends PackageCreateCommand {
    public static description = messages.getMessage('commandDescription');

    protected static requiresUsername = false;
    protected static requiresDevhubUsername = true;
    protected static requiresProject = true;

    public static examples = [
        `$ sfpowerscripts package:unlocked:create -n <packagealias> -b -x -v <devhubalias> --refname <name>`,
        `$ sfpowerscripts package:unlocked:create -n <packagealias> -b -x -v <devhubalias> --diffcheck --gittag\n`,
        `Output variable:`,
        `sfpowerscripts_package_version_id`,
        `<refname>_sfpowerscripts_package_version_id`,
        `sfpowerscripts_artifact_metadata_directory`,
        `<refname>_sfpowerscripts_artifact_metadata_directory`,
        `sfpowerscripts_artifact_directory`,
        `<refname>_sfpowerscripts_artifact_directory`,
        `sfpowerscripts_package_version_number`,
        `<refname>_sfpowerscripts_package_version_number`,
    ];

    public static flags = {
        package: Flags.string({
            required: true,
            char: 'n',
            description: messages.getMessage('packageFlagDescription'),
        }),
        installationkey: Flags.string({
            char: 'k',
            description: messages.getMessage('installationKeyFlagDescription'),
            exclusive: ['installationkeybypass'],
        }),
        installationkeybypass: Flags.boolean({
            char: 'x',
            description: messages.getMessage('installationKeyBypassFlagDescription'),
            exclusive: ['installationkey'],
        }),
        diffcheck: Flags.boolean({
            description: messages.getMessage('diffCheckFlagDescription'),
        }),
        gittag: Flags.boolean({
            description: messages.getMessage('gitTagFlagDescription'),
        }),
        requiredDevHubFlag,
        repourl: Flags.string({
            char: 'r',
            description: messages.getMessage('repoUrlFlagDescription'),
        }),
        versionnumber: Flags.string({
            description: messages.getMessage('versionNumberFlagDescription'),
        }),
        configfilepath: Flags.file({
            char: 'f',
            description: messages.getMessage('configFilePathFlagDescription'),
            default: 'config/project-scratch-def.json',
        }),
        artifactdir: Flags.directory({
            description: messages.getMessage('artifactDirectoryFlagDescription'),
            default: 'artifacts',
        }),
        enablecoverage: Flags.boolean({
            description: messages.getMessage('enableCoverageFlagDescription'),
        }),
        isvalidationtobeskipped: Flags.boolean({
            char: 's',
            description: messages.getMessage('isValidationToBeSkippedFlagDescription'),
        }),
        branch: Flags.string({
            description: messages.getMessage('branchFlagDescription'),
        }),
        tag: Flags.string({
            description: messages.getMessage('tagFlagDescription'),
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

    public async create(): Promise<SfpPackage> {
        //TODO: Use tag info
        let tag: string = this.flags.tag;
        let installationkeybypass = this.flags.installationkeybypass;
        let isCoverageEnabled: boolean = this.flags.enablecoverage;
        let isSkipValidation: boolean = this.flags.isvalidationtobeskipped;
        let installationkey = this.flags.installationkey;
        let waitTime = this.flags.waittime;

        //Handle Installation Keys
        if (installationkey === null || installationkey === undefined) {
            installationkeybypass = true;
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
                configFilePath: this.flags.configfilepath,
            },
            {
                devHub: this.hubOrg.getUsername(),
                installationkeybypass: installationkeybypass as boolean,
                breakBuildIfEmpty: true,
                waitTime: waitTime as string,
                isCoverageEnabled: isCoverageEnabled as boolean,
                isSkipValidation: isSkipValidation as boolean,
            }
        );

        console.log(COLOR_SUCCESS(`Created unlocked package ${sfpPackage.packageName}`));
        return sfpPackage;
    }

    protected getConfigFilePath(): string {
        return this.flags.configfilepath;
    }
}
