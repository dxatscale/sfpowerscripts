import SFPLogger, { COLOR_KEY_MESSAGE, Logger, LoggerLevel } from '../logger/SFPLogger';
import { Connection } from '@salesforce/core';
import { UpsertResult } from 'jsforce';

export default class DeploymentSettingsService {
    constructor(private conn: Connection) {}

    //Enable Synchronus Compile on Deploy
    public async enableSynchronousCompileOnDeploy(logger: Logger) {
        try {
            let apexSettingMetadata = { fullName: 'ApexSettings', enableCompileOnDeploy: true };
            let result: UpsertResult | UpsertResult[] = await this.conn.metadata.upsert(
                'ApexSettings',
                apexSettingMetadata
            );
            if ((result as UpsertResult).success) {
                SFPLogger.log(
                    `${COLOR_KEY_MESSAGE(
                        'Enabled Synchronous Compile on Org succesfully as this is the last package in queue'
                    )}`,
                    LoggerLevel.INFO,
                    logger
                );
            }
        } catch (error) {
            SFPLogger.log(
                `Skipping Synchronous Compile on Org succesfully due to ${error}..`,
                LoggerLevel.INFO,
                logger
            );
        }
    }
}
