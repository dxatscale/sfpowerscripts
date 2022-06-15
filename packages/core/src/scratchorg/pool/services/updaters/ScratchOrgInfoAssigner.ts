import { LoggerLevel, Org } from '@salesforce/core';
let retry = require('async-retry');
import SFPLogger from '../../../../logger/SFPLogger';
import ScratchOrgInfoFetcher from '../fetchers/ScratchOrgInfoFetcher';

export default class ScratchOrgInfoAssigner {
    constructor(private hubOrg: Org) {}

    public async setScratchOrgInfo(soInfo: any): Promise<boolean> {
        let hubConn = this.hubOrg.getConnection();

        return retry(
            async (bail) => {
                let result = await hubConn.sobject('ScratchOrgInfo').update(soInfo);
                SFPLogger.log('Setting Scratch Org Info:' + JSON.stringify(result), LoggerLevel.TRACE);
                return result.constructor !== Array ? result.success : true;
            },
            { retries: 3, minTimeout: 3000 }
        );
    }

    public async setScratchOrgStatus(username: string, status: 'Allocate' | 'InProgress' | 'Return'): Promise<boolean> {
        let scratchOrgId = await new ScratchOrgInfoFetcher(this.hubOrg).getScratchOrgInfoIdGivenUserName(username);

        return this.setScratchOrgInfo({
            Id: scratchOrgId,
            Allocation_status__c: status,
        });
    }
}
