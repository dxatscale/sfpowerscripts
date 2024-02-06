import { Messages } from '@salesforce/core';
import SfpCommand from '../../SfpCommand';
import { Stage } from '../../impl/Stage';
import SFPLogger, { COLOR_KEY_MESSAGE, ConsoleLogger } from '@flxblio/sfp-logger';
import { Flags } from '@oclif/core';
import { loglevel } from '../../flags/sfdxflags';
import { ZERO_BORDER_TABLE } from '../../ui/TableConstants';
import ImpactedPackageResolver, { ImpactedPackageProps } from '../../impl/impact/ImpactedPackagesResolver';
const Table = require('cli-table');
import path from 'path';
import * as fs from 'fs-extra';


Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@flxblio/sfp', 'impact_package');

export default class Package extends SfpCommand {
    public static flags = {
        loglevel,
        basebranch: Flags.string({
            description: messages.getMessage('baseCommitOrBranchFlagDescription'),
            required: true,
        })
    };

    public static description = messages.getMessage('commandDescription');
    private props: ImpactedPackageProps;

    async execute(): Promise<any> {
        // Read Manifest

        this.props = {
            currentStage: Stage.BUILD,
            baseBranch: this.flags.basebranch,
            diffOptions: {
                useLatestGitTags: true,
                skipPackageDescriptorChange: false,
            },
        };

        const impactedPackageResolver = new ImpactedPackageResolver(this.props, new ConsoleLogger());

        let packagesToBeBuiltWithReasons = await impactedPackageResolver.getImpactedPackages();
        let packageDiffTable = this.createDiffPackageScheduledDisplayedAsATable(packagesToBeBuiltWithReasons);
        const packagesToBeBuilt = Array.from(packagesToBeBuiltWithReasons.keys());

        //Log Packages to be built
        SFPLogger.log(COLOR_KEY_MESSAGE('Packages impacted...'));
        SFPLogger.log(packageDiffTable.toString());

        
        const outputPath = path.join(process.cwd(), 'impacted-package.json');
        if (packagesToBeBuilt && packagesToBeBuilt.length > 0)
            fs.writeFileSync(outputPath, JSON.stringify(packagesToBeBuilt, null, 2));
        else fs.writeFileSync(outputPath, JSON.stringify([], null, 2));
        SFPLogger.log(`Impacted packages if any written to ${outputPath}`);


       return packagesToBeBuilt;
    }

    private createDiffPackageScheduledDisplayedAsATable(packagesToBeBuilt: Map<string, any>) {
        let tableHead = ['Package', 'Reason', 'Last Known Tag'];
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

 
}
