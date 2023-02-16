import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { Org } from '@salesforce/core';
import { PoolBaseImpl } from './PoolBaseImpl';
import ScratchOrg from '../ScratchOrg';
import ScratchOrgInfoFetcher from './services/fetchers/ScratchOrgInfoFetcher';
import ScratchOrgOperator from '../ScratchOrgOperator';

export default class OrphanedOrgsDeleteImpl extends PoolBaseImpl {
    public constructor(hubOrg: Org, private logger:Logger) {
        super(hubOrg);
        this.hubOrg = hubOrg;
    }

    protected async onExec(): Promise<ScratchOrg[]> {
        const results = (await new ScratchOrgInfoFetcher(this.hubOrg).getOrphanedScratchOrgs()) as any;

        let scratchOrgToDelete: ScratchOrg[] = new Array<ScratchOrg>();
        if (results.records.length > 0) {
            let scrathOrgIds: string[] = [];
            for (let element of results.records) {
                if (element.Description?.includes(`"requestedBy":"sfpowerscripts"`)) {
                    let soDetail: ScratchOrg = {};
                    soDetail.orgId = element.ScratchOrg;
                    soDetail.username = element.SignupUsername;
                    soDetail.status = 'recovered';
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
                        SFPLogger.log(`Scratch org with username ${scratchOrg.SignupUsername} is recovered`,LoggerLevel.TRACE,this.logger);
                    }
                }
            }
        }

        return scratchOrgToDelete;
    }
}
