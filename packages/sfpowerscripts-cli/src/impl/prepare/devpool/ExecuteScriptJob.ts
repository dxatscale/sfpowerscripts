import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender";
import { AuthInfo, Connection, LoggerLevel, Org } from "@salesforce/core";
import PoolJobExecutor, {
  ScriptExecutionResult,
} from "../../pool/PoolJobExecutor";
import ScratchOrg from "../../pool/ScratchOrg";
import * as fs from "fs-extra";
import { EOL } from "os";
import SFPLogger from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import path from "path";
import { exec } from "child_process";
import RelaxIPRange from "../../pool/operations/RelaxIPRange";
import ScratchOrgInfoAssigner from "../../pool/services/updaters/ScratchOrgInfoAssigner";
import { PoolConfig } from "../../pool/PoolConfig";

export default class ExecuteScriptJob implements PoolJobExecutor {
  constructor(private pool:PoolConfig) {}

  async execute(
    scratchOrg: ScratchOrg,
    hubOrg: Org
  ): Promise<ScriptExecutionResult> {
    try {
      //Create file logger
      fs.outputFileSync(
        `.sfpowerscripts/prepare_logs/${scratchOrg.alias}.log`,
        `sfpowerscripts--log${EOL}`
      );

      let scratchOrgLogger: any = `.sfpowerscripts/prepare_logs/${scratchOrg.alias}.log`;

      this.pool.devpool.scriptToExecute = path.normalize(this.pool.devpool.scriptToExecute);

      let cmd;
      if (process.platform != "win32") {
        cmd = `bash ${this.pool.devpool.scriptToExecute}  ${
          scratchOrg.username
        }  ${hubOrg.getUsername()} `;
      } else {
        cmd = `cmd.exe /c ${this.pool.devpool.scriptToExecute}  ${
          scratchOrg.username
        }  ${hubOrg.getUsername()}`;
      }


      await this.relaxIPRanges(scratchOrg,this.pool.devpool.relaxAllIPRanges,this.pool.devpool.ipRangesToBeRelaxed,scratchOrgLogger);
      SFPLogger.log(`Executing command: ${cmd}`,null,scratchOrgLogger);

      return new Promise((resolve, reject) => {
        let ls = exec(cmd, { cwd: process.cwd() }, (error, stdout, stderr) => {
          if (error) {
            SFPLogger.log(
              `Failed to execute script for ${scratchOrg.username}`,
              null,
              null,
              LoggerLevel.WARN
            );
            scratchOrg.isScriptExecuted = false;
  
            resolve({
              isSuccess: false,
              message: error.message,
              scratchOrgUsername: scratchOrg.username,
              status: "failure",
            });
            return;
          }
  
          scratchOrg.isScriptExecuted = true;
          SFPLogger.log(
              `Script Execution completed for ${scratchOrg.username} with alias ${scratchOrg.alias}`,
              null,
              null,
              LoggerLevel.INFO
            );
            new ScratchOrgInfoAssigner(hubOrg).setScratchOrgInfo(
              {
                Id: scratchOrg.recordId,
                Pooltag__c: this.pool.tag,
                Allocation_status__c: "Available",
                Password__c: scratchOrg.password,
                SfdxAuthUrl__c: scratchOrg.sfdxAuthUrl,
              }
            ).then(
              (result: boolean) => {
                scratchOrg.isScriptExecuted = true;
                fs.closeSync(scratchOrgLogger);
                resolve({
                  isSuccess: true,
                  message: "Successfuly set the scratch org record in Pool",
                  scratchOrgUsername: scratchOrg.username,
                  status: "success",
                });
              },
              (reason: any) => {
                fs.closeSync(scratchOrgLogger);
                scratchOrg.isScriptExecuted = false;
                resolve({
                  isSuccess: false,
                  message: "Unable to set the scratch org record in Pool",
                  scratchOrgUsername: scratchOrg.username,
                  status: "failure",
                });
              }
            );
          
        });
  
        ls.stderr.on("data", function (data) {
          fs.appendFileSync(`script_exec_outputs/${scratchOrg.alias}.log`, data);
        });
  
        ls.stdout.on("data", function (data) {
          fs.appendFileSync(`script_exec_outputs/${scratchOrg.alias}.log`, data);
        });
      });

    } catch (error) {
      SFPStatsSender.logCount("prepare.org.failed");
      return {
        status: "failure",
        isSuccess: false,
        message: error.message,
        scratchOrgUsername: scratchOrg.username,
      };
    }
  }

  

  private async relaxIPRanges(
    scratchOrg: ScratchOrg,
    isRelaxAllIPRanges:boolean,
    relaxIPRanges:string[],
    logger:any
  ): Promise<{ username: string; success: boolean }> {
    SFPLogger.log(
      `Relaxing ip ranges for scratchOrg with user ${scratchOrg.username}`,
      null,
      null,
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





