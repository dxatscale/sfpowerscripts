import child_process = require("child_process");
import SFPLogger, { COLOR_TRACE, Logger, LoggerLevel } from "../../logger/SFPLogger";

export default class ExecuteCommand
{
 

  public constructor(
    protected logger?: Logger,
    protected logLevel?: LoggerLevel,
    protected showProgress?:boolean
    ) {}




   public execCommand(command:string, workingdirectory:string, timeout: number = 0, isEnableErrorFromOutputStream:boolean=false):Promise<any>
   {
    return new Promise((resolve, reject) => {
      try
      {
      let childProcess;

       childProcess = child_process.exec(command, {
        encoding: "utf8",
        cwd: workingdirectory,
        maxBuffer: 1024*1024*5,
        timeout: timeout
      });




      // variables for collecting data written to STDOUT and STDERR
      let stdoutContents = ''
      let stderrContents = ''

      // collect data written to STDOUT into a string
      childProcess.stdout.on('data', (data) => {
          stdoutContents += data.toString();
          if(this.showProgress)
            SFPLogger.log(COLOR_TRACE(data),LoggerLevel.INFO,this.logger)
      });

      // collect data written to STDERR into a string
      childProcess.stderr.on('data', (data) => {
         stderrContents += data.toString();
      });


      childProcess.once('close', (code: number, signal: string) => {

        if (code === 0 || (code === null && signal === "SIGTERM")) {
          resolve(stdoutContents);
        } else {
          if(stderrContents && !isEnableErrorFromOutputStream)
          reject(new Error(stderrContents));
          else
          reject(new Error(stdoutContents));
          }
      });


      childProcess.once('error', (err: Error) => {
        if(stderrContents && !isEnableErrorFromOutputStream)
         reject(new Error(stderrContents));
        else
          reject(new Error(stdoutContents));
      });
      }
      catch(error)
      {
        reject(error);
      }
    });
   }

}