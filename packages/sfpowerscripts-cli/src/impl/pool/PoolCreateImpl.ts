import { Org } from "@salesforce/core";
import Bottleneck from "bottleneck";
import { EOL } from "os";
import CreateScratchOrg from "./operations/CreateScratchOrg";
import DeleteScratchOrg from "./operations/DeleteScratchOrg";
import { PoolConfig} from "./PoolConfig";
import { PoolBaseImpl } from "./PoolBaseImpl";
import ScratchOrg from "./ScratchOrg";
import ScratchOrgInfoFetcher from "./services/fetchers/ScratchOrgInfoFetcher";
import ScratchOrgLimitsFetcher from "./services/fetchers/ScratchOrgLimitsFetcher";
import ScratchOrgInfoAssigner from "./services/updaters/ScratchOrgInfoAssigner";
import * as rimraf from "rimraf";
import * as fs from "fs-extra";
import SFPLogger from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import PoolJobExecutor, { ScriptExecutionResult } from "./PoolJobExecutor";
import src from "../..";



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
    private poolScriptExecutor:PoolJobExecutor
  ) {
    super(hubOrg);
    this.limiter = new Bottleneck({
      maxConcurrent: this.pool.batchsize,
    });

    this.scriptExecutorWrappedForBottleneck = this.limiter.wrap(
      this.scriptExecutor
    );
  }


  protected async onExec(): Promise<PoolConfig> {

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
    this.totalToBeAllocated = await this.computeAllocation();


    if (this.totalToBeAllocated === 0) {
      if (this.limits.ActiveScratchOrgs.Remaining > 0) {
        console.log(
          `The tag provided ${this.pool.tag} is currently at the maximum capacity , No scratch orgs will be allocated`
        );

        //throw MaxCapacityError
        // return {
        //   totalallocated: this.totalToBeAllocated,
        //   success: 0,
        //   failed: 0,
        //   errorCode: "Max_Capacity",
        // };
      } else {
        console.log(
          `There is no capacity to create a pool at this time, Please try again later`
        );
        // throw NoCapacityError
        // return {
        //   totalallocated: this.totalToBeAllocated,
        //   success: 0,
        //   failed: 0,
        //   errorCode: "No_Capacity",
        // };
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
 
     return this.pool;
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
        pool.maxallocation - pool.current_allocation > 0
        ? pool.maxallocation - pool.current_allocation
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

    console.log(
      `Current Allocation of ScratchOrgs in the pool ${this.pool.tag}: ` +
      pool.current_allocation
    );
    console.log(
      "Remaining Active scratchOrgs in the org: " + remainingScratchOrgs
    );
    console.log("ScratchOrgs to be allocated: " + pool.to_allocate);

    return pool.to_allocate;
  }

  private async generateScratchOrgs() {
    //Generate Scratch Orgs
  
      let count = 1;
      this.pool.scratchOrgs = new Array<ScratchOrg>();
      for (let i = 0; i < this.pool.to_allocate; i++) {
        console.log(
          `Creating Scratch  Org  ${count} of ${this.totalToBeAllocated}..`
        );
        try {
          let scratchOrg: ScratchOrg = await this.createScratchOrgOperator.createScratchOrg(
            count,
            null,
            this.pool.configFilePath,
            this.pool.expiry
          );
          this.pool.scratchOrgs.push(scratchOrg);
          this.totalAllocated++;
        } catch (error) {
          console.log(error);
          console.log(`Unable to provision scratch org  ${count} ..   `);
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

        console.log(EOL);
        console.log(
          `Failed to execute scripts for ${scratchOrg.username} with alias ${scratchOrg.alias} due to`
        );
        console.log(scratchOrg.failureMessage);

        try {
          //Delete scratchorgs that failed to execute script

          let activeScratchOrgRecordId = await this.scratchOrgInfoFetcher.getActiveScratchOrgRecordIdGivenScratchOrg(
            scratchOrg.orgId
          );

          // await this.deleteScratchOrgOperator.deleteScratchOrg(
          //   [activeScratchOrgRecordId]
          // );
          console.log(`Succesfully deleted scratchorg  ${scratchOrg.username}`);
        } catch (error) {
          console.log(
            `Unable to delete the scratchorg ${scratchOrg.username}.. due to\n`,error
          );
        }
        console.log(EOL);
        this.pool.failedToCreate+=1;
        this.pool.scratchOrgs.splice(i,1);
      }
   
  }



  private async scriptExecutor(
    scratchOrg: ScratchOrg
  ): Promise<ScratchOrg> {
    
    console.log(
      `Executing script for ${scratchOrg.alias} with username: ${scratchOrg.username}`
    );

    console.log(
      `Script Execution result is being written to .sfpowerscripts/prepare_logs/${scratchOrg.alias}.log, Please note this will take a significant time depending on the  script being executed`
    );


  
    let result = await this.poolScriptExecutor.execute(scratchOrg,this.hubOrg);

    if (result.isSuccess) {
      scratchOrg.isScriptExecuted = true;
      let submitInfoToPool = await this.scratchOrgInfoAssigner.setScratchOrgInfo(
        {
          Id: scratchOrg.recordId,
          Pooltag__c: this.pool.tag,
          Allocation_status__c:  "Available"
        }
      );
      if (!submitInfoToPool) {
        scratchOrg.isScriptExecuted = false;
        scratchOrg.failureMessage = "Unable to set the scratch org record in Pool";
      }
    } else {
      scratchOrg.isScriptExecuted = false;
      scratchOrg.failureMessage = result.message;
    }
    
    return scratchOrg;
  }

}

