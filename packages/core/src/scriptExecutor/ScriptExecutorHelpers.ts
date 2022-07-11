import ExecuteCommand from '../command/commandExecutor/ExecuteCommand';
import SFPLogger, { Logger, LoggerLevel } from '../logger/SFPLogger';
import defaultShell from '../utils/DefaultShell';

export default class scriptExecutorHelpers {
    static async executeScript(args: any[], logger: Logger) {
        let cmd: string;
        if (process.platform !== 'win32') {
            cmd = `${defaultShell()} -e args[0] args[1] args[2] args[3] args[4]`;
        } else {
            cmd = `cmd.exe /c args[0] args[1] args[2] args[3] args[4]`;
        }

        SFPLogger.log(`Executing command.. ${cmd}`,LoggerLevel.INFO,logger);
        let scriptExecutor: ExecuteCommand = new ExecuteCommand(logger, LoggerLevel.INFO, true);
        let result = await scriptExecutor.execCommand(cmd, null);
        SFPLogger.log(result, LoggerLevel.INFO, logger);
    }
  }
