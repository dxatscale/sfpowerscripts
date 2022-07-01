import ExecuteCommand from '../command/commandExecutor/ExecuteCommand';
import SFPLogger, { Logger, LoggerLevel } from '../logger/SFPLogger';
import defaultShell from '../utils/DefaultShell';

export default class scriptExecutorHelpers {
    static async executeScript(script: string, sfdx_package: string, targetOrg: string, devHub: string, logger: Logger) {
        let cmd: string;
        if (process.platform !== 'win32') {
            cmd = `${defaultShell()} -e ${script} ${sfdx_package} ${targetOrg} ${devHub}`;
        } else {
            cmd = `cmd.exe /c ${script} ${sfdx_package} ${targetOrg} ${devHub}`;
        }

        SFPLogger.log(`Executing command.. ${cmd}`,LoggerLevel.INFO,logger);
        let scriptExecutor: ExecuteCommand = new ExecuteCommand(logger, LoggerLevel.INFO, true);
        let result = await scriptExecutor.execCommand(cmd, null);
        SFPLogger.log(result, LoggerLevel.INFO, logger);
    }
  }
