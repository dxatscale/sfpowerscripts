import { AuthInfo, Connection, LoggerLevel, Org } from "@salesforce/core";
import PoolJobExecutor, {
  JobError,
  ScriptExecutionResult,
} from "../../pool/PoolJobExecutor";
import SFPLogger, {
  FileLogger,
  Logger,
} from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import path = require("path");
import { PoolConfig } from "../../pool/PoolConfig";
import SpawnCommand from "@dxatscale/sfpowerscripts.core/lib/command/commandExecutor/SpawnCommand";
import { Result, ok, err } from "neverthrow";
import ScratchOrg from "@dxatscale/sfpowerscripts.core/src/scratchorg/ScratchOrg";
import RelaxIPRange from "@dxatscale/sfpowerscripts.core/lib/iprange/RelaxIPRange"


export default class PrepareDevOrgWithScript extends PoolJobExecutor {
  constructor(protected pool: PoolConfig) {
    super(pool);
  }

  async executeJob(
    scratchOrg: ScratchOrg,
    hubOrg: Org,
    logToFilePath: string
  ): Promise<Result<ScriptExecutionResult, JobError>> {
    try {
      this.pool.devpool.scriptToExecute = path.normalize(
        this.pool.devpool.scriptToExecute
      );

      let scratchOrgLogger: FileLogger = new FileLogger(logToFilePath);
      let cmd;
      if (process.platform != "win32") {
        cmd = `bash`;
      } else {
        cmd = `cmd.exe`;
      }
      await this.relaxIPRanges(
        scratchOrg,
        this.pool.devpool.relaxAllIPRanges,
        this.pool.devpool.ipRangesToBeRelaxed,
        scratchOrgLogger
      );
      SFPLogger.log(`Executing command: ${cmd} ${[ this.pool.devpool.scriptToExecute, scratchOrg.username,hubOrg.getUsername()]}`);
      SFPLogger.log(`Logs for preparing org ${scratchOrg.username} written to ${logToFilePath}`);

      let executor: SpawnCommand = new SpawnCommand();
      await executor.execCommand(cmd, null,[ this.pool.devpool.scriptToExecute, scratchOrg.username,hubOrg.getUsername()],logToFilePath);


      return ok({ scratchOrgUsername: scratchOrg.username });


    } catch (error) {
      console.log(error);
      return err({
        message: error.message,
        scratchOrgUsername: scratchOrg.username,
      });
    }
  }

  private async relaxIPRanges(
    scratchOrg: ScratchOrg,
    isRelaxAllIPRanges: boolean,
    relaxIPRanges: string[],
    logger: Logger
  ): Promise<{ username: string; success: boolean }> {
    SFPLogger.log(
      `Relaxing ip ranges for scratchOrg with user ${scratchOrg.username}`,
      LoggerLevel.INFO
    );
    const connection = await Connection.create({
      authInfo: await AuthInfo.create({ username: scratchOrg.username }),
    });

    if (isRelaxAllIPRanges) {
      relaxIPRanges = [];
      return new RelaxIPRange(logger).setIp(
        connection,
        scratchOrg.username,
        relaxIPRanges,
        true
      );
    } else {
      return new RelaxIPRange(logger).setIp(
        connection,
        scratchOrg.username,
        relaxIPRanges
      );
    }
  }
}
