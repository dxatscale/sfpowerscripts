import { Org } from "@salesforce/core";
import Bottleneck from "bottleneck";
import CreateScratchOrg from "@dxatscale/sfpowerscripts.core/lib/scratchorg/CreateScratchOrg";
import DeleteScratchOrg from "@dxatscale/sfpowerscripts.core/lib/scratchorg/DeleteScratchOrg";
import { PoolConfig} from "./PoolConfig";
import { PoolBaseImpl } from "./PoolBaseImpl";
import ScratchOrg from "@dxatscale/sfpowerscripts.core/lib/scratchorg/ScratchOrg";
import ScratchOrgInfoFetcher from "./services/fetchers/ScratchOrgInfoFetcher";
import ScratchOrgLimitsFetcher from "./services/fetchers/ScratchOrgLimitsFetcher";
import ScratchOrgInfoAssigner from "./services/updaters/ScratchOrgInfoAssigner";
import * as rimraf from "rimraf";
import * as fs from "fs-extra";
import PoolJobExecutor, { ScriptExecutionResult } from "./PoolJobExecutor";
import { PoolError, PoolErrorCodes } from "./PoolError";
import SFPLogger, { COLOR_KEY_MESSAGE, LoggerLevel } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import { Result ,ok,err} from "neverthrow"
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender";
import { EOL } from "os";
import OrgDetailsFetcher from "@dxatscale/sfpowerscripts.core/lib/org/OrgDetailsFetcher";



export default class PoolCreateImpl extends PoolBaseImpl
{


  private limiter;
  private scriptExecutorWrappedForBottleneck;
  private limits: any;
  private scratchOrgInfoFetcher: ScratchOrgInfoFetcher;
  private scratchOrgInfoAssigner: ScratchOrgInfoAssigner;
  private createScratchOrgOperator: CreateScratchOrg;
  private deleteScratchOrgOperator: DeleteScratchOrg;
  private totalToBeAllocated: number;
  private totalAllocated: number=0;


  public constructor(
    hubOrg: Org,
    private pool:PoolConfig,
    private poolScriptExecutor:PoolJobExecutor,
    private logLevel:LoggerLevel
  ) {
    super(hubOrg);
    this.limiter = new Bottleneck({
      maxConcurrent: this.pool.batchSize,
    });

    this.scriptExecutorWrappedForBottleneck = this.limiter.wrap(
      this.scriptExecutor
    );
  }


  protected async onExec(): Promise<Result<PoolConfig,PoolError>> {

    await this.hubOrg.refreshAuth();

    let scriptExecPromises: Array<Promise<ScriptExecutionResult>> = new Array();

    //fetch current status limits
   this.limits = await new ScratchOrgLimitsFetcher(this.hubOrg).getScratchOrgLimits()

   //Create Service classes
   this.scratchOrgInfoFetcher = new ScratchOrgInfoFetcher(this.hubOrg);
   this.scratchOrgInfoAssigner = new ScratchOrgInfoAssigner(this.hubOrg);

   //Create Operators
   this.createScratchOrgOperator = new CreateScratchOrg(this.hubOrg);
   this.deleteScratchOrgOperator = new DeleteScratchOrg(this.hubOrg);

    //Compute allocation

    SFPLogger.log(COLOR_KEY_MESSAGE("Computing Allocation.."),LoggerLevel.INFO);
    try
    {
    this.totalToBeAllocated = await this.computeAllocation();
    }catch(error)
    {
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
          errorCode: PoolErrorCodes.No_Capacity
        });
      }
    }


    // Setup Logging Directory
    rimraf.sync("script_exec_outputs");
    fs.mkdirpSync("script_exec_outputs");



     //Generate Scratch Orgs
     await this.generateScratchOrgs();

     // Assign workers to executed scripts
      for (let scratchOrg of this.pool.scratchOrgs) {
         let result = this.scriptExecutorWrappedForBottleneck(
           scratchOrg,
           this.hubOrg.getUsername()
         );
         scriptExecPromises.push(result);
       }


     await Promise.all(scriptExecPromises);

     await this.finalizeGeneratedScratchOrgs();

     if(this.pool.scratchOrgs.length==0)
     {
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
    let activeCount = await this.scratchOrgInfoFetcher.getCountOfActiveScratchOrgsByTag(
      this.pool.tag
    );
    return this.allocateScratchOrgsPerTag(
      this.limits.ActiveScratchOrgs.Remaining,
      activeCount,
      this.pool
    );
  }

  private allocateScratchOrgsPerTag(
    remainingScratchOrgs: number,
    countOfActiveScratchOrgs: number,
    pool:PoolConfig
  ) {
    pool.current_allocation = countOfActiveScratchOrgs;
    pool.to_allocate = 0;
    pool.to_satisfy_max =
        pool.maxAllocation - pool.current_allocation > 0
        ? pool.maxAllocation - pool.current_allocation
        : 0;

    if (
      pool.to_satisfy_max > 0 &&
      pool.to_satisfy_max <= remainingScratchOrgs
    ) {
      pool.to_allocate = pool.to_satisfy_max;
    } else if (
      pool.to_satisfy_max > 0 &&
      pool.to_satisfy_max > remainingScratchOrgs
    ) {
      pool.to_allocate = remainingScratchOrgs;
    }

    SFPLogger.log(
      `${EOL}Current Allocation of ScratchOrgs in the pool ${this.pool.tag}: ` +
      pool.current_allocation, LoggerLevel.INFO
    );
    SFPLogger.log(
      "Remaining Active scratchOrgs in the org: " + remainingScratchOrgs,LoggerLevel.INFO
    );
    SFPLogger.log("ScratchOrgs to be allocated: " + pool.to_allocate,LoggerLevel.INFO);
    return pool.to_allocate;
  }

  private async generateScratchOrgs() {
    //Generate Scratch Orgs
     SFPLogger.log(COLOR_KEY_MESSAGE("Generate Scratch Orgs.."),LoggerLevel.INFO);
      let count = 1;
      this.pool.scratchOrgs = new Array<ScratchOrg>();

      for (let i = 0; i < this.pool.to_allocate; i++) {
        SFPLogger.log(
          `Creating Scratch  Org  ${count} of ${this.totalToBeAllocated}..`
        );
        try {
          let scratchOrg: ScratchOrg = await this.createScratchOrgOperator.createScratchOrg(
            count,
            null,
            this.pool.configFilePath,
            this.pool.expiry
          );

          let orgDetails = await new OrgDetailsFetcher(scratchOrg.username).getOrgDetails();
          if (orgDetails.status === "Deleted") {
            throw new Error(`Throwing away scratch org ${count} as it has a status of deleted`);
          }

          this.pool.scratchOrgs.push(scratchOrg);
          this.totalAllocated++;
        } catch (error) {
          SFPLogger.log(error,LoggerLevel.ERROR);
          SFPLogger.log(`Unable to provision scratch org  ${count} ..   `,LoggerLevel.ERROR);
        }
        count++;
      }

     this.pool.scratchOrgs= await this.scratchOrgInfoFetcher.getScratchOrgRecordId(this.pool.scratchOrgs);

      let scratchOrgInprogress = [];



      if(this.pool.scratchOrgs)
      {
      this.pool.scratchOrgs.forEach((scratchOrg) => {
        scratchOrgInprogress.push({
          Id: scratchOrg.recordId,
          Pooltag__c: this.pool.tag,
          Password__c: scratchOrg.password,
          SfdxAuthUrl__c:scratchOrg.sfdxAuthUrl,
          Allocation_status__c: "In Progress",
        });
      });

      if (scratchOrgInprogress.length > 0) {
        //set pool tag
        await this.scratchOrgInfoAssigner.setScratchOrgInfo(
          scratchOrgInprogress
        );
      }
    }
  }


  private async finalizeGeneratedScratchOrgs() {


      this.pool.failedToCreate=0;
      for (let i = this.pool.scratchOrgs.length -1; i >= 0 ; i--) {
        let scratchOrg = this.pool.scratchOrgs[i];
        if (scratchOrg.isScriptExecuted) {
          continue;
        }


        SFPLogger.log(
          `Failed to execute scripts for ${scratchOrg.username} with alias ${scratchOrg.alias} due to ${scratchOrg.failureMessage}`,LoggerLevel.ERROR
        );

        try {
          //Delete scratchorgs that failed to execute script

          let activeScratchOrgRecordId = await this.scratchOrgInfoFetcher.getActiveScratchOrgRecordIdGivenScratchOrg(
            scratchOrg.orgId
          );

          await this.deleteScratchOrgOperator.deleteScratchOrg(
            [activeScratchOrgRecordId]
          );
          console.log(`Succesfully deleted scratchorg  ${scratchOrg.username}`);
        } catch (error) {
          SFPLogger.log(
            `Unable to delete the scratchorg ${scratchOrg.username}.. due to\n`+error,
            LoggerLevel.ERROR
          );
        }

        this.pool.failedToCreate+=1;
        this.pool.scratchOrgs.splice(i,1);
      }

  }



  private async scriptExecutor(
    scratchOrg: ScratchOrg
  ): Promise<ScratchOrg> {

    SFPLogger.log(
      `Executing Preparation Job ${scratchOrg.alias} with username: ${scratchOrg.username}`,LoggerLevel.INFO
    );

    let startTime = Date.now();
    let result = await this.poolScriptExecutor.execute(scratchOrg,this.hubOrg,this.logLevel);

    if (result.isOk()) {
      scratchOrg.isScriptExecuted = true;
      let submitInfoToPool = await this.scratchOrgInfoAssigner.setScratchOrgInfo(
        {
          Id: scratchOrg.recordId,
          Allocation_status__c:  "Available"
        }
      );
      if (!submitInfoToPool) {
        scratchOrg.isScriptExecuted = false;
        scratchOrg.failureMessage = "Unable to set the scratch org record in Pool";
        SFPStatsSender.logCount("prepare.org.failed");
      }
      else
      {
        SFPStatsSender.logCount("prepare.org.succeeded");
      }


      SFPStatsSender.logElapsedTime("prepare.org.singlejob",Date.now()-startTime);
    } else {
      scratchOrg.isScriptExecuted = false;
      scratchOrg.failureMessage = result.error.message;
      SFPStatsSender.logCount("prepare.org.failed");
    }

    return scratchOrg;
  }

}
