import { ChildProcess } from "child_process";

export async function onExit(childProcess: ChildProcess): Promise<{}> {
    return new Promise((resolve, reject) => {
      
      childProcess.once('exit', (code: number, signal: string) => {
        if (code === 0) {
          resolve(undefined);
        } else {
          reject(new Error('Exit with error code: '+code));
        }
      });


      childProcess.once('error', (err: Error) => {
        reject(err);
      });
         
    });
  }