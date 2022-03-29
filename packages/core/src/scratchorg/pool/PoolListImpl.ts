import { Org } from '@salesforce/core';
import { PoolBaseImpl } from './PoolBaseImpl';
import ScratchOrg from '../ScratchOrg';
import ScratchOrgInfoFetcher from './services/fetchers/ScratchOrgInfoFetcher';

export default class PoolListImpl extends PoolBaseImpl {
    private tag: string;
    private allScratchOrgs: boolean;

    public constructor(hubOrg: Org, tag: string, allScratchOrgs: boolean) {
        super(hubOrg);
        this.hubOrg = hubOrg;
        this.tag = tag;
        this.allScratchOrgs = allScratchOrgs;
    }

    protected async onExec(): Promise<ScratchOrg[]> {
        const results = (await new ScratchOrgInfoFetcher(this.hubOrg).getScratchOrgsByTag(
            this.tag,
            null,
            !this.allScratchOrgs
        )) as any;

        let scratchOrgList: ScratchOrg[] = new Array<ScratchOrg>();
        if (results.records.length > 0) {
            for (let element of results.records) {
                let soDetail: ScratchOrg = {};
                soDetail.tag = element.Pooltag__c;
                soDetail.orgId = element.ScratchOrg;
                soDetail.loginURL = element.LoginUrl;
                soDetail.username = element.SignupUsername;
                soDetail.password = element.Password__c;
                soDetail.expiryDate = element.ExpirationDate;
                if (element.Allocation_status__c === 'Assigned') {
                    soDetail.status = 'In use';
                } else if (element.Allocation_status__c === 'Available') {
                    soDetail.status = 'Available';
                } else {
                    soDetail.status = 'Provisioning in progress';
                }

                scratchOrgList.push(soDetail);
            }
        }

        return scratchOrgList;
    }
}
