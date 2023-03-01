import child_process = require('child_process');
import * as fs from 'fs-extra';

export default class SpawnCommand {
    public execCommand(command: string, workingdirectory: string, args: string[], fileToLog: string): Promise<any> {
        return new Promise((resolve, reject) => {
            try {
                let childProcess;

                childProcess = child_process.spawn(command, args, {
                    cwd: workingdirectory,
                });

                // collect data written to STDOUT into a string
                childProcess.stdout.on('data', (data) => {
                    fs.appendFileSync(fileToLog, data);
                });

                // collect data written to STDERR into a string
                childProcess.stderr.on('data', (data) => {
                    fs.appendFileSync(fileToLog, data);
                });

                childProcess.once('close', (code: number, signal: string) => {
                    if (code === 0 || (code === null && signal === 'SIGTERM')) {
                        resolve(fileToLog);
                    } else {
                        reject(fileToLog);
                    }
                });

                childProcess.once('error', (err: Error) => {
                    reject(fileToLog);
                });
            } catch (error) {
                reject(error);
            }
        });
    }
}
