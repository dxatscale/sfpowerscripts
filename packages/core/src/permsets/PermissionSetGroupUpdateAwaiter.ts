import { Connection } from '@salesforce/core';
import SFPLogger, { Logger, LoggerLevel } from '../logger/SFPLogger';
import QueryHelper from '../queryHelper/QueryHelper';
import { delay } from '../utils/Delay';

const psGroupQuery = `SELECT Id,MasterLabel,Status FROM PermissionSetGroup WHERE Status = 'Updating'`;

export default class PermissionSetGroupUpdateAwaiter {
    constructor(private connection: Connection, private logger: Logger, private intervalBetweenRepeats = 30000) {}

    async waitTillAllPermissionSetGroupIsUpdated() {
        SFPLogger.log(
            `Checking status of permission sets group..`,
            LoggerLevel.INFO,
            this.logger
        );
        while (true) {
            try {
                let records = await QueryHelper.query(psGroupQuery, this.connection, false);
                if (records.length > 0) {
                    SFPLogger.log(
                        `Pausing deployment as ${records.length} PermissionSetGroups are being updated`,
                        LoggerLevel.INFO,
                        this.logger
                    );
                    SFPLogger.log(
                        `Retrying for status in next ${this.intervalBetweenRepeats / 1000} seconds`,
                        LoggerLevel.INFO,
                        this.logger
                    );
                    await delay(this.intervalBetweenRepeats);
                } else {
                    SFPLogger.log(
                        `Proceeding with deployment,as no PermissionSetGroups are being updated`,
                        LoggerLevel.INFO,
                        this.logger
                    );
                    break;
                }
            } catch (error) {
                console.log(error);
                SFPLogger.log(`Unable to fetch permission group status ${error}`, LoggerLevel.TRACE, this.logger);
            }
        }
    }
}
