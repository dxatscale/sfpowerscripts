const Table = require('cli-table');
import {  LazyCollection, SourceComponent } from '@salesforce/source-deploy-retrieve';
import SFPLogger, { Logger, LoggerLevel } from '../logger/SFPLogger';

export default class PackageComponentPrinter {

    public static printComponentTable(components:LazyCollection<SourceComponent> , logger: Logger) {
        //If Manifest is null, just return
        if (components === null || components === undefined) return;

        let table = new Table({
            head: ['Metadata Type', 'API Name'],
        });

        let componentArray = components.toArray();
        componentArray.sort((a,b)=>a.type.name.localeCompare(b.type.name));

        for (const component of componentArray) {
            let item = [component.type.name, component.fullName];
            table.push(item);
        }

        SFPLogger.log('The following metadata will be deployed:', LoggerLevel.INFO, logger);
        SFPLogger.log(table.toString(), LoggerLevel.INFO, logger);
    }
}
