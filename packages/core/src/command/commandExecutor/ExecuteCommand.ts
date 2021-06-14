import child_process = require("child_process");
import * as fs from "fs-extra";

export default class ExecuteCommand
{
 
   public execCommand(command:string, workingdirectory:string,args?:string[],fileToLog?:string):Promise<any>
   {
    return new Promise((resolve, reject) => {
      try
      {
      let childProcess;
      if(!fileToLog)
      {
       childProcess = child_process.exec(command, {
        encoding: "utf8",
        cwd: workingdirectory,
        maxBuffer: 1024*1024*5
      });
    }
     else
     {
      childProcess = child_process.spawn(command, args,{
        cwd: workingdirectory,
      });
     }

     
      // variables for collecting data written to STDOUT and STDERR
      let stdoutContents = ''
      let stderrContents = ''
  
      // collect data written to STDOUT into a string
      childProcess.stdout.on('data', (data) => {
        if(fileToLog)
          fs.appendFileSync(fileToLog, data);
        else
          stdoutContents += data.toString();
      });
  
      // collect data written to STDERR into a string
      childProcess.stderr.on('data', (data) => {
        if(fileToLog)
        fs.appendFileSync(fileToLog, data);
       else
         stderrContents += data.toString();
      });
  

      childProcess.once('close', (code: number, signal: string) => {

        if (code === 0 || (code === null && signal === "SIGTERM")) {
          resolve(fileToLog?fileToLog:stdoutContents);
        } else {
          if(fileToLog)
          {
            reject(fileToLog);
          }
          else
          {
          if(stdoutContents)
          reject(new Error(stdoutContents));
          else 
          reject(new Error(stdoutContents+"\n"+stderrContents));
          }
        }
      });


      childProcess.once('error', (err: Error) => {
        if(fileToLog)
          reject(fileToLog)
        else if(stderrContents)
         reject(new Error(stdoutContents+"\n"+stderrContents));
      });
      }
      catch(error)
      {
        reject(error);
      }
    });
   }
   
}