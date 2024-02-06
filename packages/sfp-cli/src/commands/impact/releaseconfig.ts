import { Messages } from '@salesforce/core';
import SfpCommand from '../../SfpCommand';
import { Stage } from '../../impl/Stage';
import * as fs from 'fs-extra';
import SFPLogger, { COLOR_KEY_MESSAGE, ConsoleLogger } from '@flxblio/sfp-logger';
import { Flags } from '@oclif/core';
import { loglevel } from '../../flags/sfdxflags';
import { ZERO_BORDER_TABLE } from '../../ui/TableConstants';
import path from 'path';
import ImpactedPackageResolver, { ImpactedPackageProps } from '../../impl/impact/ImpactedPackagesResolver';
import ImpactedRelaseConfigResolver from '../../impl/impact/ImpactedReleaseConfig';
const Table = require('cli-table');


Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@flxblio/sfp', 'impact_release_config');

export default class ReleaseConfig extends SfpCommand {
    public static flags = {
        loglevel,
        branch: Flags.string({
            description: messages.getMessage('branchFlagDescription'),
        }),
        basebranch: Flags.string({
            description: messages.getMessage('baseCommitOrBranchFlagDescription'),
            required: true,
        }),
        releaseconfig: Flags.string({
            description: messages.getMessage('releaseConfigFileFlagDescription'),
            default: 'config',
        }),
        explicitDependencyCheck: Flags.boolean({
            description: messages.getMessage('explicitDependencyCheckFlagDescription'),
            default: false,
        }),
        filterBy: Flags.string({
            description: messages.getMessage('filterByFlagDescription'),
        }),
        filterByChangesInBranch: Flags.boolean({
            description: messages.getMessage('filterByChangesInBranchFlagDescription'),
        }),
    };

    public static description = messages.getMessage('commandDescription');
    private props: ImpactedPackageProps;
    isMultiConfigFilesEnabled: boolean;

    async execute(): Promise<any> {
        // Read Manifest

        this.props = {
            branch: this.flags.branch,
            currentStage: Stage.VALIDATE,
            baseBranch: this.flags.basebranch,
            diffOptions: {
                useLatestGitTags: true,
                skipPackageDescriptorChange: false,
            },
        };

        if(this.flags.filterByChangesInBranch)
        {
            this.props.diffOptions.useBranchCompare=true;
            this.props.diffOptions.branch=this.flags.branch;
            this.props.diffOptions.baseBranch=this.flags.basebranch;
        }

        const impactedPackageResolver = new ImpactedPackageResolver(this.props, new ConsoleLogger());

        let packagesToBeBuiltWithReasons = await impactedPackageResolver.getImpactedPackages();
        let packageDiffTable = this.createDiffPackageScheduledDisplayedAsATable(packagesToBeBuiltWithReasons);
        const packagesToBeBuilt = Array.from(packagesToBeBuiltWithReasons.keys());

        //Log Packages to be built
        SFPLogger.log(COLOR_KEY_MESSAGE('Packages impacted...'));
        SFPLogger.log(packageDiffTable.toString());

        const impactedReleaseConfigResolver = new ImpactedRelaseConfigResolver();

        let impactedReleaseConfigs = impactedReleaseConfigResolver.getImpactedReleaseConfigs(
            packagesToBeBuilt,
            this.flags.releaseconfig,
            this.flags.explicitDependencyCheck,
            this.flags.filterBy
        );

        let impactedReleaseConfigTable = this.createImpactedReleaseConfigsAsATable(impactedReleaseConfigs.include);
        //Log Packages to be built
        SFPLogger.log(COLOR_KEY_MESSAGE('Release Configs  impacted...'));
        SFPLogger.log(impactedReleaseConfigTable.toString());

        const outputPath = path.join(process.cwd(), 'impacted-release-configs.json');
        if (impactedReleaseConfigs && impactedReleaseConfigs.include.length > 0)
            fs.writeFileSync(outputPath, JSON.stringify(impactedReleaseConfigs, null, 2));
        else fs.writeFileSync(outputPath, JSON.stringify([], null, 2));
        if (!this.flags.filterBy) SFPLogger.log(`Impacted release configs written to ${outputPath}`);
        else
            SFPLogger.log(
                `Impacted release configs written to ${outputPath},${
                    impactedReleaseConfigs.include[0]?.releaseName
                        ? `filtered  impacted release config found for ${impactedReleaseConfigs.include[0]?.releaseName}`
                        : `no impacted release config found for ${this.flags.filterBy}`
                }`
            );

        return impactedReleaseConfigs.include;
    }

    private createDiffPackageScheduledDisplayedAsATable(packagesToBeBuilt: Map<string, any>) {
        let tableHead = ['Package', 'Reason', 'Last Known Tag'];
        if (this.isMultiConfigFilesEnabled && this.props.currentStage == Stage.BUILD) {
            tableHead.push('Scratch Org Config File');
        }
        let table = new Table({
            head: tableHead,
            chars: ZERO_BORDER_TABLE,
        });
        for (const pkg of packagesToBeBuilt.keys()) {
            let item = [
                pkg,
                packagesToBeBuilt.get(pkg).reason,
                packagesToBeBuilt.get(pkg).tag ? packagesToBeBuilt.get(pkg).tag : '',
            ];
          
            table.push(item);
        }
        return table;
    }

    private createImpactedReleaseConfigsAsATable(impacatedReleaseConfigs: any[]) {
        let tableHead = ['Release/Domain Name', 'Pools', 'ReleaseConfig Path'];
        let table = new Table({
            head: tableHead,
            chars: ZERO_BORDER_TABLE,
        });
        for (const impactedReleaseConfig of impacatedReleaseConfigs) {
            let item = [
                impactedReleaseConfig.releaseName,
                impactedReleaseConfig.pool,
                impactedReleaseConfig.filePath,
            ];
            table.push(item);
        }
        return table;
    }
}
