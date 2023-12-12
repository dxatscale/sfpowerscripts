import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { ZERO_BORDER_TABLE } from './TableConstants';
const Table = require('cli-table');
import { BuildStreamService } from '../eventStream/build';

export default class PackageDependencyDisplayer {
    public static printPackageDependencies(
        dependencies: { package: string; versionNumber?: string }[],
        projectConfig: any,
        logger: Logger,
        pck?: string
    ) {
        if (Array.isArray(dependencies)) {
            SFPLogger.log('Package Dependencies:', LoggerLevel.INFO, logger);
            const table = new Table({
                head: ['Order','Package', 'Version'],
                chars: ZERO_BORDER_TABLE,
                style: { 'padding-left': 3 },
            });
            let order=1;
            for (const dependency of dependencies) {
                let versionNumber = 'N/A';

                if (!dependency.versionNumber)
                    versionNumber = projectConfig.packageAliases[dependency.package]
                        ? projectConfig.packageAliases[dependency.package]
                        : 'N/A';
                else versionNumber = dependency.versionNumber;

                const row = [order,dependency.package, versionNumber];
                table.push(row);
                if(pck){
                    BuildStreamService.buildPackageDependencies(pck,{order:order, pck: dependency.package, version: versionNumber});
                }
                order++;
            }
            SFPLogger.log(table.toString(), LoggerLevel.INFO, logger);
        }
    }
}
