const Table = require('cli-table');
import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { ZERO_BORDER_TABLE } from './TableConstants';

export default class PushErrorDisplayer {
    public static printMetadataFailedToPush(error: any, packageLogger: Logger) {
        if (error == null) return;

        let table;
        let pushComponentFailureIntoTable;
        if (error.name === 'sourceConflictDetected') {
            table = new Table({
                head: ['State', 'API Name', 'Metadata Type', 'File Path'],
                chars: ZERO_BORDER_TABLE
            });

            pushComponentFailureIntoTable = (componentFailure) => {
                let item = [
                    componentFailure.state,
                    componentFailure.fullName,
                    componentFailure.type,
                    componentFailure.filePath,
                ];

                // Replace "undefined" values with "NA". cli-table breaks for undefined cells
                item.forEach((elem, idx, item) => {
                    if (elem === undefined) {
                        item[idx] = 'NA';
                    }
                });

                table.push(item);
            };
        } else if (error.name === 'DeployFailed') {
            table = new Table({
                head: ['Metadata Type', 'API Name', 'Problem Type', 'FilePath','Problem'],
            });

            pushComponentFailureIntoTable = (componentFailure) => {
                let item = [
                    componentFailure.type,
                    componentFailure.fullName,
                    componentFailure.problemType,
                    componentFailure.error,
                    componentFailure.filePath,
                ];

                // Replace "undefined" values with "NA". cli-table breaks for undefined cells
                item.forEach((elem, idx, item) => {
                    if (elem === undefined) {
                        item[idx] = 'NA';
                    }
                });

                table.push(item);
            };
        } else {
            SFPLogger.log('Unknown error type. Failed to print table.', LoggerLevel.ERROR, packageLogger);
            return;
        }

        if (error.data instanceof Array) {
            for (let componentFailure of error.data) {
                pushComponentFailureIntoTable(componentFailure);
            }
        } else {
            let failure = error.data;
            pushComponentFailureIntoTable(failure);
        }

        SFPLogger.log('The following components resulted in failures:', LoggerLevel.ERROR, packageLogger);

        SFPLogger.log(table.toString(), LoggerLevel.ERROR, packageLogger);
    }
}
