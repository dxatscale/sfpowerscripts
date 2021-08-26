import { Org } from "@salesforce/core";
import { PoolConfig } from "./PoolConfig";
import ScratchOrg from "@dxatscale/sfpowerscripts.core/lib/scratchorg/ScratchOrg";
import { Result } from "neverthrow";
import * as fs from "fs-extra";
import { EOL } from "os";
import SFPLogger, { LoggerLevel } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";

export default abstract class PoolJobExecutor {
  protected logToFilePath: string;

  constructor(protected pool: PoolConfig) {}

  async execute(
    scratchOrg: ScratchOrg,
    hubOrg: Org,
    logLevel: LoggerLevel
  ): Promise<Result<ScriptExecutionResult, JobError>> {
    this.logToFilePath = `.sfpowerscripts/prepare_logs/${scratchOrg.alias}.log`;
    //Create file logger
    fs.outputFileSync(this.logToFilePath, `sfpowerscripts--log${EOL}`);
    SFPLogger.log(`Preparation Log files for ${scratchOrg.username} written to ${this.logToFilePath}`)
    return this.executeJob(scratchOrg, hubOrg, this.logToFilePath,logLevel);
  }

  abstract executeJob(
    scratchOrg: ScratchOrg,
    hubOrg: Org,
    logToFilePath: string,
    logLevel: LoggerLevel
  ): Promise<Result<ScriptExecutionResult, JobError>>;
}

export interface ScriptExecutionResult {
  scratchOrgUsername: string;
}

export interface JobError {
  message: string;
  scratchOrgUsername: string;
}
