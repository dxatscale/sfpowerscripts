import SFPLogger, { COLOR_KEY_MESSAGE, Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { Connection } from '@salesforce/core';
import { IpRange, SecuritySettings } from 'jsforce/lib/api/metadata';

export default class DeploymentSettingsService {
    constructor(private conn: Connection) {}

    //Enable Synchronus Compile on Deploy
    public async enableSynchronousCompileOnDeploy(logger: Logger) {
        try {
            let apexSettingMetadata = { fullName: 'ApexSettings', enableCompileOnDeploy: true };
            let result = await this.conn.metadata.upsert('ApexSettings', apexSettingMetadata);
            if (result.success) {
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

    public async relaxAllIPRanges(logger: Logger, ipRangesAsStringArray?: string[]) {
        let ipRanges: IpRange[] = [];
        if (!ipRangesAsStringArray) {
            ipRanges = this.getFullRange();
        } else {
            ipRanges = [];
            //transform to ipRange Array
            for (const ipRange of ipRangesAsStringArray) {
                ipRanges.push({ start: ipRange, end: ipRange });
            }
        }
        let securitySettingsMetadata: SecuritySettings = {
            fullName: 'SecuritySettings',
            networkAccess: { ipRanges: ipRanges },
        };
        try {
            let result = await this.conn.metadata.upsert('SecuritySettings', securitySettingsMetadata);
            if (result.success) {
                SFPLogger.log(`${COLOR_KEY_MESSAGE('Relaxed all ipRanges in the org')}`, LoggerLevel.INFO, logger);
            }
        } catch (error) {
            SFPLogger.log(`Unable to relax IP range in org due to ${error.message}`, LoggerLevel.ERROR, logger);
            throw error;
        }
    }

    private getFullRange(): IpRange[] {
        let ipRanges = [];
        for (let i = 0; i < 255; i += 2) {
            ipRanges.push({ start: `${i}.0.0.0`, end: `${i + 1}.255.255.255` });
        }
        return ipRanges;
    }
}
