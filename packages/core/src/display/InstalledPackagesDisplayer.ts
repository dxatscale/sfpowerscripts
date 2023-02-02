const Table = require('cli-table');
import SFPLogger, { Logger, LoggerLevel, COLOR_KEY_MESSAGE } from '@dxatscale/sfp-logger';
import Package2Detail from '../package/Package2Detail';
import { ZERO_BORDER_TABLE } from './TableConstants';

export default class InstalledPackagesDisplayer {
    public static printInstalledPackages(packages: Package2Detail[], logger: Logger) {
        if (packages == null) return;

        let table = new Table({
            head: ['Package', 'Version', 'Type', 'isOrgDependent'],
            chars: ZERO_BORDER_TABLE
        });

        packages.forEach((pkg) => {
            table.push([pkg.name, pkg.versionNumber, pkg.type, pkg.isOrgDependent]);
        });

        SFPLogger.log(COLOR_KEY_MESSAGE('Packages installed in org:'), LoggerLevel.INFO, logger);
        SFPLogger.log(table.toString(), LoggerLevel.INFO, logger);
    }
}
