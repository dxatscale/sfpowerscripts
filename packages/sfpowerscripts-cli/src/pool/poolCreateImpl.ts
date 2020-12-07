import ScratchOrgUtils, { ScratchOrg } from "./utils/ScratchOrgUtils";
import { LoggerLevel, Org } from "@salesforce/core";
import * as fs from "fs-extra";
import Bottleneck from "bottleneck";
import * as path from "path";
import * as rimraf from "rimraf";
import { SfdxApi } from "./sfdxnode/types";
import SFPLogger from "@dxatscale/sfpowerscripts.core/lib/utils/SFPLogger";
import PrepareASingleOrgImpl, {
  ScriptExecutionResult,
} from "../prepare/PrepareASingleOrgImpl";

export default class PoolCreateImpl {
  private poolConfig: PoolConfig;
  private totalToBeAllocated: number;
  private limits;
  private totalAllocated: number = 0;
  private limiter;
  private scriptExecutorWrappedForBottleneck;

  public constructor(
    private hubOrg: Org,
    private apiversion: string,
    private sfdx: SfdxApi,
    private tag: string,
    private expiry: number,
    private max_allocation: number,
    private configFilePath: string,
    private batchSize: number,
    private fetchArtifactScript: string,
    private installAll:boolean
  ) {
    this.limiter = new Bottleneck({
      maxConcurrent: this.batchSize,
    });

    this.scriptExecutorWrappedForBottleneck = this.limiter.wrap(
      this.scriptExecutor
    );
  }

  public async poolScratchOrgs(): Promise<boolean> {
    await ScratchOrgUtils.checkForNewVersionCompatible(this.hubOrg);
    let scriptExecPromises: Array<Promise<ScriptExecutionResult>> = new Array();
    let ipRangeExecPromises: Array<Promise<{
      username: string;
      success: boolean;
    }>> = new Array();

    await this.hubOrg.refreshAuth();

    let preRequisiteCheck = await ScratchOrgUtils.checkForPreRequisite(
      this.hubOrg
    );

    if (!preRequisiteCheck) {
      SFPLogger.log(
        "Required Prerequisite fields are missing in the DevHub, Please look into the wiki to getting the fields deployed in DevHub"
      );
      return false;
    }

    //Set Pool Config Option
    this.poolConfig = {
      pool: {
        expiry: this.expiry,
        config_file_path: this.configFilePath,
        tag: this.tag,
        max_allocation: this.max_allocation,
        user_mode: false,
      },
    };

    //Set Tag Only mode activated for the default use case
    this.setASingleUserForTagOnlyMode();

    //fetch current status limits
    await this.fetchCurrentLimits();

    //Compute allocation
    this.totalToBeAllocated = await this.computeAllocation();

    if (this.totalToBeAllocated === 0) {
      if (this.limits.ActiveScratchOrgs.Remaining > 0)
        SFPLogger.log(
          `The tag provided ${this.poolConfig.pool.tag} is currently at the maximum capacity , No scratch orgs will be allocated`
        );
      else
        SFPLogger.log(
          `There is no capacity to create a pool at this time, Please try again later`
        );
      return;
    }

    //Generate Scratch Orgs
    await this.generateScratchOrgs();

    // Setup Logging Directory
    rimraf.sync("script_exec_outputs");
    fs.mkdirpSync("script_exec_outputs");

    // Assign workers to executed scripts
    let ts = Math.floor(Date.now() / 1000);
    for (let poolUser of this.poolConfig.poolUsers) {
      for (let scratchOrg of poolUser.scratchOrgs) {
        SFPLogger.log(JSON.stringify(scratchOrg));

        let result = this.scriptExecutorWrappedForBottleneck(
          scratchOrg,
          this.hubOrg.getUsername()
        );
        scriptExecPromises.push(result);
      }
    }

    let scriptExecResults = await Promise.all(scriptExecPromises);

    SFPLogger.log(JSON.stringify(scriptExecResults), LoggerLevel.TRACE);
    ts = Math.floor(Date.now() / 1000) - ts;
    SFPLogger.log(`Pool Execution completed in ${ts} Seconds`);

    //Commit Succesfull Scratch Orgs
    let commit_result: {
      success: number;
      failed: number;
    } = await this.finalizeGeneratedScratchOrgs();

    if (this.totalAllocated > 0) {
      SFPLogger.log(
        `Request for provisioning ${this.totalToBeAllocated} scratchOrgs of which ${this.totalAllocated} were allocated with ${commit_result.success} success and ${commit_result.failed} failures`
      );
    } else {
      SFPLogger.log(
        `Request for provisioning ${this.totalToBeAllocated} scratchOrgs not successfull.`
      );
    }
    return true;
  }

  private setASingleUserForTagOnlyMode() {
    //Remove any existing pool Config for pool users
    if (this.poolConfig.poolUsers) delete this.poolConfig.poolUsers;

    let poolUser: PoolUser = {
      min_allocation: this.poolConfig.pool.max_allocation,
      max_allocation: this.poolConfig.pool.max_allocation,
      is_build_pooluser: false,
      expiry: this.poolConfig.pool.expiry,
      priority: 1,
    };
    //Add a single user
    this.poolConfig.poolUsers = [];
    this.poolConfig.poolUsers.push(poolUser);
    this.poolConfig.pool.user_mode = false;
  }

  private async fetchCurrentLimits() {
    try {
      this.limits = await ScratchOrgUtils.getScratchOrgLimits(
        this.hubOrg,
        this.apiversion
      );
    } catch (error) {
      SFPLogger.log("Unable to connect to DevHub");
      return;
    }
  }

  private async computeAllocation(): Promise<number> {
    //Compute current pool requirement

    let activeCount = await ScratchOrgUtils.getCountOfActiveScratchOrgsByTag(
      this.poolConfig.pool.tag,
      this.hubOrg
    );
    return this.allocateScratchOrgsPerTag(
      this.limits.ActiveScratchOrgs.Remaining,
      activeCount,
      this.poolConfig.pool.tag,
      this.poolConfig.poolUsers[0]
    );
  }

  private async generateScratchOrgs() {
    //Generate Scratch Orgs
    for (let poolUser of this.poolConfig.poolUsers) {
      let count = 1;
      poolUser.scratchOrgs = new Array<ScratchOrg>();
      for (let i = 0; i < poolUser.to_allocate; i++) {
        SFPLogger.log(
          `Creating Scratch  Org  ${count} of ${this.totalToBeAllocated}..`
        );
        try {
          let scratchOrg: ScratchOrg = await ScratchOrgUtils.createScratchOrg(
            this.sfdx,
            count,
            poolUser.username,
            this.poolConfig.pool.config_file_path,
            poolUser.expiry ? poolUser.expiry : this.poolConfig.pool.expiry,
            this.hubOrg
          );
          poolUser.scratchOrgs.push(scratchOrg);
          this.totalAllocated++;
        } catch (error) {
          SFPLogger.log(`Unable to provision scratch org  ${count} ..   `);
        }
        count++;
      }

      await ScratchOrgUtils.getScratchOrgRecordId(
        poolUser.scratchOrgs,
        this.hubOrg
      );

      if (ScratchOrgUtils.isNewVersionCompatible) {
        let scratchOrgInprogress = [];

        poolUser.scratchOrgs.forEach((scratchOrg) => {
          scratchOrgInprogress.push({
            Id: scratchOrg.recordId,
            Pooltag__c: this.poolConfig.pool.tag,
            Allocation_status__c: "In Progress",
          });
        });

        if (scratchOrgInprogress.length > 0) {
          //set pool tag
          await ScratchOrgUtils.setScratchOrgInfo(
            scratchOrgInprogress,
            this.hubOrg
          );
        }
      }
    }
  }

  private async finalizeGeneratedScratchOrgs(): Promise<{
    success: number;
    failed: number;
  }> {
    //Store Username Passwords
    let failed = 0;
    let success = 0;

    for (let poolUser of this.poolConfig.poolUsers) {
      for (let scratchOrg of poolUser.scratchOrgs) {
        if (scratchOrg.isScriptExecuted) {
          success++;
          continue;
        }

        SFPLogger.log(
          `Failed to execute scripts for ${scratchOrg.username} with alias ${scratchOrg.alias}.. Returning to Pool`
        );

        try {
          //Delete scratchorgs that failed to execute script

          let activeScratchOrgRecordId = await ScratchOrgUtils.getActiveScratchOrgRecordIdGivenScratchOrg(
            this.hubOrg,
            this.apiversion,
            scratchOrg.orgId
          );

          await ScratchOrgUtils.deleteScratchOrg(
            this.hubOrg,
            this.apiversion,
            activeScratchOrgRecordId
          );
          SFPLogger.log(
            `Succesfully deleted scratchorg  ${scratchOrg.username}`
          );
        } catch (error) {
          SFPLogger.log(
            `Unable to delete the scratchorg ${scratchOrg.username}..`
          );
        }

        failed++;
      }
    }

    return { success: success, failed: failed };
  }

  private allocateScratchOrgsPerTag(
    remainingScratchOrgs: number,
    countOfActiveScratchOrgs: number,
    tag: string,
    poolUser: PoolUser
  ) {
    SFPLogger.log("Remaining ScratchOrgs" + remainingScratchOrgs);
    poolUser.current_allocation = countOfActiveScratchOrgs;
    poolUser.to_allocate = 0;
    poolUser.to_satisfy_max =
      poolUser.max_allocation - poolUser.current_allocation > 0
        ? poolUser.max_allocation - poolUser.current_allocation
        : 0;

    if (
      poolUser.to_satisfy_max > 0 &&
      poolUser.to_satisfy_max <= remainingScratchOrgs
    ) {
      poolUser.to_allocate = poolUser.to_satisfy_max;
    } else if (
      poolUser.to_satisfy_max > 0 &&
      poolUser.to_satisfy_max > remainingScratchOrgs
    ) {
      poolUser.to_allocate = remainingScratchOrgs;
    }

    SFPLogger.log("Computed Allocation" + JSON.stringify(poolUser));
    return poolUser.to_allocate;
  }

  private async scriptExecutor(
    scratchOrg: ScratchOrg,
    hubOrgUserName
  ): Promise<ScriptExecutionResult> {
    //Need to call PrepareAnOrgImpl

    SFPLogger.log(
      `Executing script for ${scratchOrg.alias} with username: ${scratchOrg.username}`
    );

    SFPLogger.log(
      `Script Execution result is being written to script_exec_outputs/${scratchOrg.alias}.log, Please note this will take a significant time depending on the  script being executed`
    );

    let prepareASingleOrgImpl: PrepareASingleOrgImpl = new PrepareASingleOrgImpl(
      scratchOrg,
      hubOrgUserName,
      this.fetchArtifactScript,
      this.installAll
    );
    let result = await prepareASingleOrgImpl.prepare();

    if (result.isSuccess) {
      let submitInfoToPool = await ScratchOrgUtils.setScratchOrgInfo(
        {
          Id: scratchOrg.recordId,
          Pooltag__c: this.poolConfig.pool.tag,
          Allocation_status__c: ScratchOrgUtils.isNewVersionCompatible
            ? "Available"
            : "",
          Password__c: scratchOrg.password,
        },
        this.hubOrg
      );
      if (!submitInfoToPool) {
        result.isSuccess = false;
        result.status = "failure";
        result.message = "Unable to set the scratch org record in Pool";
      }
    }

    return result;
  }
}

export interface PoolConfig {
  pool: Pool;
  poolUsers?: PoolUser[];
}

export interface Pool {
  expiry: number;
  config_file_path: string;
  script_file_path?: string;
  tag: string;
  user_mode: boolean;
  max_allocation: number;
}

export interface PoolUser {
  max_allocation: number;
  min_allocation: number;
  is_build_pooluser: boolean;
  username?: string;
  expiry?: number;
  priority: number;
  scripts?: string[];
  current_allocation?: number;
  to_allocate?: number;
  to_satisfy_min?: number;
  to_satisfy_max?: number;
  scratchOrgs?: ScratchOrg[];
}
