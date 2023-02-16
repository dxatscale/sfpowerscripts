import SFPLogger from '@dxatscale/sfp-logger';
import { Org } from '@salesforce/core';
import { PoolBaseImpl } from './PoolBaseImpl';
import ScratchOrg from '../ScratchOrg';
import ScratchOrgInfoFetcher from './services/fetchers/ScratchOrgInfoFetcher';
import ScratchOrgOperator from '../ScratchOrgOperator';
import { Logger } from '@dxatscale/sfp-logger';
import { LoggerLevel } from '@dxatscale/sfp-logger';

export default class PoolDeleteImpl extends PoolBaseImpl {
    private tag: string;
    private mypool: boolean;
    private allScratchOrgs: boolean;
    private inprogressonly: boolean;

    public constructor(hubOrg: Org, tag: string, mypool: boolean, allScratchOrgs: boolean, inprogressonly: boolean,private logger:Logger) {
        super(hubOrg);
        this.hubOrg = hubOrg;
        this.tag = tag;
        this.mypool = mypool;
        this.allScratchOrgs = allScratchOrgs;
        this.inprogressonly = inprogressonly;
    }

    protected async onExec(): Promise<ScratchOrg[]> {
        const results = (await new ScratchOrgInfoFetcher(this.hubOrg).getScratchOrgsByTag(
            this.tag,
            this.mypool,
            !this.allScratchOrgs
        )) as any;

        let scratchOrgToDelete: ScratchOrg[] = new Array<ScratchOrg>();
        if (results.records.length > 0) {
            let scrathOrgIds: string[] = [];
            for (let element of results.records) {
                if (!this.inprogressonly || element.Allocation_status__c === 'In Progress') {
                    let soDetail: ScratchOrg = {};
                    soDetail.orgId = element.ScratchOrg;
                    soDetail.loginURL = element.LoginUrl;
                    soDetail.username = element.SignupUsername;
                    soDetail.expiryDate = element.ExpirationDate;
                    soDetail.status = 'Deleted';

                    scratchOrgToDelete.push(soDetail);
                    scrathOrgIds.push(`'${element.Id}'`);
                }
            }

            if (scrathOrgIds.length > 0) {
                let activeScrathOrgs = await new ScratchOrgInfoFetcher(this.hubOrg).getActiveScratchOrgsByInfoId(
                    scrathOrgIds.join(',')
                );

                if (activeScrathOrgs.records.length > 0) {
                    for (let scratchOrg of activeScrathOrgs.records) {
                        await new ScratchOrgOperator(this.hubOrg).delete(scratchOrg.Id);
                        SFPLogger.log(`Scratch org with username ${scratchOrg.SignupUsername} is deleted successfully`,LoggerLevel.TRACE,this.logger);
                    }
                }
            }
        }

        return scratchOrgToDelete;
    }
}
