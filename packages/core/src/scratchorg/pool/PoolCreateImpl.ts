import { Org } from '@salesforce/core';
import Bottleneck from 'bottleneck';
import { PoolConfig } from './PoolConfig';
import { PoolBaseImpl } from './PoolBaseImpl';
import ScratchOrg from '../ScratchOrg';
import ScratchOrgInfoFetcher from './services/fetchers/ScratchOrgInfoFetcher';
import ScratchOrgLimitsFetcher from './services/fetchers/ScratchOrgLimitsFetcher';
import ScratchOrgInfoAssigner from './services/updaters/ScratchOrgInfoAssigner';
import * as rimraf from 'rimraf';
import * as fs from 'fs-extra';
import PoolJobExecutor, { ScriptExecutionResult } from './PoolJobExecutor';
import { PoolError, PoolErrorCodes } from './PoolError';
import SFPLogger, { COLOR_KEY_MESSAGE, LoggerLevel } from '@dxatscale/sfp-logger';
import { Result, ok, err } from 'neverthrow';
import SFPStatsSender from '../../stats/SFPStatsSender';
import { EOL } from 'os';
import OrgDetailsFetcher from '../../org/OrgDetailsFetcher';
import ScratchOrgOperator from '../ScratchOrgOperator';
import PoolFetchImpl from './PoolFetchImpl';
import { COLOR_SUCCESS } from '@dxatscale/sfp-logger';
import { COLOR_ERROR } from '@dxatscale/sfp-logger';
import getFormattedTime from '../../utils/GetFormattedTime';
import OrphanedOrgsDeleteImpl from './OrphanedOrgsDeleteImpl';
import path from 'path';

export default class PoolCreateImpl extends PoolBaseImpl {
    private limiter;
    private scriptExecutorWrappedForBottleneck;
    private limits: any;
    private scratchOrgInfoFetcher: ScratchOrgInfoFetcher;
    private scratchOrgInfoAssigner: ScratchOrgInfoAssigner;
    private scratchOrgOperator: ScratchOrgOperator;
    private totalToBeAllocated: number;
    private totalAllocated: number = 0;

    public constructor(
        hubOrg: Org,
        private pool: PoolConfig,
        private poolScriptExecutor: PoolJobExecutor,
        private logLevel: LoggerLevel
    ) {
        super(hubOrg);
        this.limiter = new Bottleneck({
            maxConcurrent: this.pool.batchSize,
        });

        this.scriptExecutorWrappedForBottleneck = this.limiter.wrap(this.scriptExecutor);
    }

    protected async onExec(): Promise<Result<PoolConfig, PoolError>> {
        await this.hubOrg.refreshAuth();

        const scriptExecPromises: Array<Promise<ScriptExecutionResult>> = [];


        //fetch current status limits
        this.limits = await new ScratchOrgLimitsFetcher(this.hubOrg).getScratchOrgLimits();

        //Create Service classes
        this.scratchOrgInfoFetcher = new ScratchOrgInfoFetcher(this.hubOrg);
        this.scratchOrgInfoAssigner = new ScratchOrgInfoAssigner(this.hubOrg);

        //Create Operator
        this.scratchOrgOperator = new ScratchOrgOperator(this.hubOrg);

        // Setup Logging Directory
        rimraf.sync('script_exec_outputs');
        fs.mkdirpSync('script_exec_outputs');

        //Compute allocation
        try {
            if (!this.pool.snapshotPool) {
                SFPLogger.log(COLOR_KEY_MESSAGE('Computing Allocation..'), LoggerLevel.INFO);
                try {
                    this.totalToBeAllocated = await this.computeAllocation();
                } catch (error) {
                    return err({
                        success: 0,
                        failed: 0,
                        message: `Unable to access fields on ScratchOrgInfo, Please check the profile being used`,
                        errorCode: PoolErrorCodes.PrerequisiteMissing,
                    });
                }

                if (this.totalToBeAllocated === 0) {
                    if (this.limits.ActiveScratchOrgs.Remaining > 0) {
                        return err({
                            success: 0,
                            failed: 0,
                            message: `The tag provided ${this.pool.tag} is currently at the maximum capacity , No scratch orgs will be allocated`,
                            errorCode: PoolErrorCodes.Max_Capacity,
                        });
                    } else {
                        return err({
                            success: 0,
                            failed: 0,
                            message: `There is no capacity to create a pool at this time, Please try again later`,
                            errorCode: PoolErrorCodes.No_Capacity,
                        });
                    }
                }

                //Generate Scratch Orgs
                this.pool.scratchOrgs = await this.generateScratchOrgs(
                    this.pool,
                    this.scratchOrgOperator,
                    this.scratchOrgInfoAssigner
                );
            } else {
                this.pool.scratchOrgs = await this.fetchScratchOrgsFromSnapshotPool(
                    this.pool,
                    this.scratchOrgInfoFetcher,
                    this.scratchOrgInfoAssigner
                );
            }
        } catch (error) {
            return err({
                success: 0,
                failed: this.pool.failedToCreate,
                message: `All requested scratch orgs failed to provision, Please check your code or config \n Failed with ${error.message}`,
                errorCode: PoolErrorCodes.UnableToProvisionAny,
            });
        }

        // Assign workers to executed scripts
        for (const scratchOrg of this.pool.scratchOrgs) {
            const result = this.scriptExecutorWrappedForBottleneck(scratchOrg, this.hubOrg.getUsername());
            scriptExecPromises.push(result);
        }

        await Promise.all(scriptExecPromises);

        this.pool = await this.finalizeGeneratedScratchOrgs(
            this.pool,
            this.scratchOrgOperator,
            this.scratchOrgInfoFetcher
        );

        if (!this.pool.scratchOrgs || this.pool.scratchOrgs.length == 0) {
            return err({
                success: 0,
                failed: this.pool.failedToCreate,
                message: `All requested scratch orgs failed to provision, Please check your code or config`,
                errorCode: PoolErrorCodes.UnableToProvisionAny,
            });
        }
        return ok(this.pool);

      
    }

    private async computeAllocation(): Promise<number> {
        //Compute current pool requirement
        const activeCount = await this.scratchOrgInfoFetcher.getCountOfActiveScratchOrgsByTag(this.pool.tag);
        return this.allocateScratchOrgsPerTag(this.limits.ActiveScratchOrgs.Remaining, activeCount, this.pool);
    }

    private allocateScratchOrgsPerTag(
        remainingScratchOrgs: number,
        countOfActiveScratchOrgs: number,
        pool: PoolConfig
    ) {
        pool.current_allocation = countOfActiveScratchOrgs;
        pool.to_allocate = 0;
        pool.to_satisfy_max =
            pool.maxAllocation - pool.current_allocation > 0 ? pool.maxAllocation - pool.current_allocation : 0;

        if (pool.to_satisfy_max > 0 && pool.to_satisfy_max <= remainingScratchOrgs) {
            pool.to_allocate = pool.to_satisfy_max;
        } else if (pool.to_satisfy_max > 0 && pool.to_satisfy_max > remainingScratchOrgs) {
            pool.to_allocate = remainingScratchOrgs;
        }

        SFPLogger.log(
            `${EOL}Current Allocation of ScratchOrgs in the pool ${this.pool.tag}: ` + pool.current_allocation,
            LoggerLevel.INFO
        );
        SFPLogger.log('Remaining Active scratchOrgs in the org: ' + remainingScratchOrgs, LoggerLevel.INFO);
        SFPLogger.log('ScratchOrgs to be allocated: ' + pool.to_allocate, LoggerLevel.INFO);
        return pool.to_allocate;
    }

    private async generateScratchOrgs(
        pool: PoolConfig,
        scratchOrgOperator: ScratchOrgOperator,
        scratchOrgInfoAssigner: ScratchOrgInfoAssigner
    ) {
        //Generate Scratch Orgs
        SFPLogger.log(COLOR_KEY_MESSAGE('Generate Scratch Orgs..'), LoggerLevel.INFO);

        const scratchOrgPromises = new Array<Promise<ScratchOrg>>();

        const scratchOrgCreationLimiter = new Bottleneck({
            maxConcurrent: pool.batchSize,
        });

        addDescriptionToScratchOrg(pool);

        const startTime = Date.now();
        for (let i = 1; i <= pool.to_allocate; i++) {
            const scratchOrgPromise: Promise<ScratchOrg> = scratchOrgCreationLimiter.schedule(() =>
                scratchOrgOperator.create(`SO` + i, this.pool.configFilePath, this.pool.expiry, this.pool.waitTime)
            );
            scratchOrgPromises.push(scratchOrgPromise);
        }

        SFPLogger.log(`Waiting for all scratch org request to complete, Please wait`);
        //Wait for all orgs to be created
        const scratchOrgCreationResults = await Promise.allSettled(scratchOrgPromises);
        //Only worry about scrath orgs that have suceeded
        const isFulfilled = <T>(p: PromiseSettledResult<T>): p is PromiseFulfilledResult<T> => p.status === 'fulfilled';
        const isRejected = <T>(p: PromiseSettledResult<T>): p is PromiseRejectedResult => p.status === 'rejected';

        let scratchOrgs = scratchOrgCreationResults.filter(isFulfilled).map((p) => p.value);
        const rejectedScratchOrgs = scratchOrgCreationResults.filter(isRejected).map((p) => p.reason);
        for (const reason of rejectedScratchOrgs) {
            if (reason.message.includes(`The client has timed out`)) {
                //Log how many we were able to create
                const elapsedTime = Date.now() - startTime;
                SFPLogger.log(
                    `A scratch org creation was rejected due to saleforce not responding within the set wait time of ${pool.waitTime} mins \n` +
                        `Time elasped so far ${COLOR_KEY_MESSAGE(
                            getFormattedTime(elapsedTime)
                        )},You might need to inrease the wait time further and rety `
                );
            } else SFPLogger.log(`A scratch org creation was rejected due to ${reason.message}`);
        }

        //Log how many we were able to create
        const elapsedTime = Date.now() - startTime;
        SFPLogger.log(
            `Created ${COLOR_SUCCESS(scratchOrgs.length)} of ${pool.to_allocate} successfully with ${COLOR_ERROR(
                rejectedScratchOrgs.length
            )} failures in ${COLOR_KEY_MESSAGE(getFormattedTime(elapsedTime))}`
        );

        SFPStatsSender.logElapsedTime(`pool.scratchorg.creation.time`, elapsedTime, { pool: pool.tag });
        if (scratchOrgs && scratchOrgs.length > 0) {
            //Splice scratchorgs that are having incorrect status of deleted , Why salesforce why??
            let index = scratchOrgs.length;
            while (index--) {
                try {
                    const orgDetails = await new OrgDetailsFetcher(scratchOrgs[index].username).getOrgDetails();
                    if (orgDetails.status === 'Deleted') {
                        throw new Error(
                            `Throwing away scratch org ${this.pool.scratchOrgs[index].alias} as it has a status of deleted`
                        );
                    }
                } catch (error) {
                    scratchOrgs.splice(index, 1);
                }
            }

            scratchOrgs = await this.scratchOrgInfoFetcher.getScratchOrgRecordId(scratchOrgs);

            const scratchOrgInprogress = [];

            scratchOrgs.forEach((scratchOrg) => {
                scratchOrgInprogress.push({
                    Id: scratchOrg.recordId,
                    Pooltag__c: this.pool.tag,
                    Password__c: scratchOrg.password,
                    SfdxAuthUrl__c: scratchOrg.sfdxAuthUrl,
                    Allocation_status__c: 'In Progress',
                });
            });

            if (scratchOrgInprogress.length > 0) {
                //set pool tag
                await scratchOrgInfoAssigner.setScratchOrgInfo(scratchOrgInprogress);
            }
            return scratchOrgs;
        } else throw new Error(`No scratch orgs were sucesfully generated`);

        function addDescriptionToScratchOrg(pool: PoolConfig) {

            const configClonePath = path.join('.sfpowerscripts','scratchorg-configs',`${ makeFileId(8)}.json`);
            fs.mkdirpSync('.sfpowerscripts/scratchorg-configs');
            fs.copyFileSync(pool.configFilePath,configClonePath);

            const scratchOrgDefn = fs.readJSONSync(configClonePath);
            if (!scratchOrgDefn.description)
                scratchOrgDefn.description = JSON.stringify({
                    requestedBy: 'sfpowerscripts',
                    pool: pool.tag,
                    requestedAt: new Date().toISOString(),
                });
            else
                scratchOrgDefn.description = scratchOrgDefn.description.concat(
                    ' ',
                    JSON.stringify({
                        requestedBy: 'sfpowerscripts',
                        pool: pool.tag,
                        requestedAt: new Date().toISOString(),
                    })
                );
            fs.writeJSONSync(configClonePath, scratchOrgDefn, { spaces: 4 });
            pool.configFilePath = configClonePath;
        }

        function makeFileId(length): string {
            let result = '';
            const characters =
                'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            const charactersLength = characters.length;
            for (let i = 0; i < length; i++) {
                result += characters.charAt(Math.floor(Math.random() * charactersLength));
            }
            return result;
        }
    }

    private async fetchScratchOrgsFromSnapshotPool(
        pool: PoolConfig,
        scratchOrgInfoFetcher: ScratchOrgInfoFetcher,
        scratchOrgInfoAssigner: ScratchOrgInfoAssigner
    ) {
        //Generate Scratch Orgs
        SFPLogger.log(
            COLOR_KEY_MESSAGE(`Fetching Scratch Orgs from snapshot pool ${this.pool.snapshotPool}`),
            LoggerLevel.INFO
        );

        let scratchOrgs = (await new PoolFetchImpl(
            this.hubOrg,
            this.pool.snapshotPool,
            false,
            true,
            undefined,
            undefined,
            undefined,
            true,
            this.pool.maxAllocation
        ).execute()) as ScratchOrg[];
        scratchOrgs = await scratchOrgInfoFetcher.getScratchOrgRecordId(scratchOrgs);

        const scratchOrgInprogress = [];

        if (scratchOrgs && scratchOrgs.length > 0) {
            scratchOrgs.forEach((scratchOrg) => {
                scratchOrgInprogress.push({
                    Id: scratchOrg.recordId,
                    Pooltag__c: this.pool.tag,
                    Password__c: scratchOrg.password,
                    SfdxAuthUrl__c: scratchOrg.sfdxAuthUrl,
                    Allocation_status__c: 'In Progress',
                });
            });

            if (scratchOrgInprogress.length > 0) {
                //set pool tag
                await scratchOrgInfoAssigner.setScratchOrgInfo(scratchOrgInprogress);
            }
            return scratchOrgs;
        } else {
            throw new Error('No scratch orgs were found to be fetched');
        }
    }

    private async finalizeGeneratedScratchOrgs(
        pool: PoolConfig,
        scratchOrgOperator: ScratchOrgOperator,
        scratchOrgInfoFetcher: ScratchOrgInfoFetcher
    ) {
        pool.failedToCreate = 0;
        for (let i = pool.scratchOrgs.length - 1; i >= 0; i--) {
            const scratchOrg = pool.scratchOrgs[i];
            if (scratchOrg.isScriptExecuted) {
                continue;
            }

            SFPLogger.log(
                `Failed to execute scripts for ${scratchOrg.username} with alias ${scratchOrg.alias} due to ${scratchOrg.failureMessage}`,
                LoggerLevel.ERROR
            );

            try {
                //Delete scratchorgs that failed to execute script

                const activeScratchOrgRecordId = await scratchOrgInfoFetcher.getActiveScratchOrgRecordIdGivenScratchOrg(
                    scratchOrg.orgId
                );

                await scratchOrgOperator.delete([activeScratchOrgRecordId]);
                console.log(`Succesfully deleted scratchorg ${scratchOrg.username}`);
            } catch (error) {
                SFPLogger.log(
                    `Unable to delete the scratchorg ${scratchOrg.username}.. due to\n` + error,
                    LoggerLevel.ERROR
                );
            }

            pool.failedToCreate += 1;
            pool.scratchOrgs.splice(i, 1);
        }
        return pool;
    }

    private async scriptExecutor(scratchOrg: ScratchOrg): Promise<ScratchOrg> {
        SFPLogger.log(
            `Executing Preparation Job ${scratchOrg.alias} with username: ${scratchOrg.username}`,
            LoggerLevel.INFO
        );

        const startTime = Date.now();
        const result = await this.poolScriptExecutor.execute(scratchOrg, this.hubOrg, this.logLevel);

        if (result.isOk()) {
            scratchOrg.isScriptExecuted = true;
            const submitInfoToPool = await this.scratchOrgInfoAssigner.setScratchOrgInfo({
                Id: scratchOrg.recordId,
                Allocation_status__c: 'Available',
            });
            if (!submitInfoToPool) {
                scratchOrg.isScriptExecuted = false;
                scratchOrg.failureMessage = 'Unable to set the scratch org record in Pool';
                SFPStatsSender.logCount('prepare.org.failed');
            } else {
                SFPStatsSender.logCount('prepare.org.succeeded');
            }

            SFPStatsSender.logElapsedTime('prepare.org.singlejob.elapsed_time', Date.now() - startTime, {
                poolname: this.pool.tag,
            });
        } else {
            scratchOrg.isScriptExecuted = false;
            scratchOrg.failureMessage = result.error.message;
            SFPStatsSender.logCount('prepare.org.failed');
        }

        return scratchOrg;
    }
}
