import { Org } from '@salesforce/core';
import { PoolBaseImpl } from './PoolBaseImpl';
import ScratchOrgInfoFetcher from './services/fetchers/ScratchOrgInfoFetcher';
import ScratchOrgOperator from '../ScratchOrgOperator';

export default class PoolOrgDeleteImpl extends PoolBaseImpl {
    username: string;

    public constructor(hubOrg: Org, username: string) {
        super(hubOrg);
        this.hubOrg = hubOrg;
        this.username = username;
    }

    protected async onExec(): Promise<void> {
        try {
            let scratchOrgId = await new ScratchOrgInfoFetcher(this.hubOrg).getScratchOrgIdGivenUserName(this.username);
            await new ScratchOrgOperator(this.hubOrg).delete(scratchOrgId);
        } catch (err) {
            throw new Error(
                `Either the scratch org doesn't exist or you do not have the correct permissions, Failed with ` +
                    err.message
            );
        }
    }
}
