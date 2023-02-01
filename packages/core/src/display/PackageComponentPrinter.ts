const Table = require('cli-table');
import { LazyCollection, SourceComponent } from '@salesforce/source-deploy-retrieve';
import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { ZERO_BORDER_TABLE } from './TableConstants';

export default class PackageComponentPrinter {
    public static printComponentTable(components: LazyCollection<SourceComponent>, logger: Logger) {
        //If Manifest is null, just return
        if (components === null || components === undefined) return;

        let table = new Table({
            head: ['Metadata Type', 'API Name'],
            chars: ZERO_BORDER_TABLE
        });

        let componentArray = components.toArray();
        componentArray.sort((a, b) => a.type.name.localeCompare(b.type.name));

        for (const component of componentArray) {
            let item = [component.type.name, component.fullName];
            table.push(item);
        }

        SFPLogger.log('The following metadata will be deployed:', LoggerLevel.INFO, logger);
        SFPLogger.log(table.toString(), LoggerLevel.INFO, logger);
    }
}
