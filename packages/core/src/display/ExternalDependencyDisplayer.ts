import SFPLogger, { COLOR_KEY_MESSAGE, Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { EOL } from 'os';
import Package2Detail from '../package/Package2Detail';
const Table = require('cli-table');

export default class ExternalDependencyDisplayer {
    public constructor(private externalPackage2s: Package2Detail[], private logger: Logger) {}

    public display() {
      if (this.externalPackage2s.length > 0) {
        let table = new Table({
            head: ['Order', 'Package', 'Version', 'Subscriber Version Id'],
        });
            let i = 0;
            for (const externalPackage of this.externalPackage2s) {
                table.push([
                    i++,
                    externalPackage.name,
                    externalPackage.versionNumber ? externalPackage.versionNumber : 'N/A',
                    externalPackage.subscriberPackageVersionId,
                ]);
            }
            SFPLogger.log(EOL, LoggerLevel.INFO, this.logger);
            SFPLogger.log(COLOR_KEY_MESSAGE(`Resolved Package Dependencies`), LoggerLevel.INFO, this.logger);
            SFPLogger.log(table.toString(), LoggerLevel.INFO, this.logger);
        }
    }
}