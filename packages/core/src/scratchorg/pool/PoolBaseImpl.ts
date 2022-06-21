import { Org } from '@salesforce/core';
import { Result } from 'neverthrow';
import ScratchOrg from '../ScratchOrg';
import { PoolConfig } from './PoolConfig';
import { PoolError } from './PoolError';
import PreRequisiteCheck from './prequisitecheck/PreRequisiteCheck';

export abstract class PoolBaseImpl {
    protected hubOrg: Org;

    constructor(hubOrg: Org) {
        this.hubOrg = hubOrg;
    }

    public async execute(): Promise<ScratchOrg | ScratchOrg[] | Result<PoolConfig, PoolError>|void> {
        let prerequisiteCheck: PreRequisiteCheck = new PreRequisiteCheck(this.hubOrg);
        await prerequisiteCheck.checkForPrerequisites();
        return this.onExec();
    }

    protected abstract onExec(): Promise<ScratchOrg | ScratchOrg[] | Result<PoolConfig, PoolError>|void>;
}
