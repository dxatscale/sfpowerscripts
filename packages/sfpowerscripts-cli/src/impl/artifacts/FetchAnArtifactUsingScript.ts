import SFPLogger, { COLOR_WARNING, LoggerLevel } from '@dxatscale/sfp-logger';
const fs = require('fs-extra');
import child_process = require('child_process');
import FetchAnArtifact from './FetchAnArtifact';
import defaultShell from '@dxatscale/sfpowerscripts.core/lib/utils/DefaultShell';

export class FetchAnArtifactUsingScript implements FetchAnArtifact {
    constructor(private scriptPath: string) {}

    public fetchArtifact(
        packageName: string,
        artifactDirectory: string,
        version: string,
        isToContinueOnMissingArtifact: boolean
    ) {
        try {
            let cmd: string;

            //Create artifact Directory if it doesnt exist
            if (!fs.existsSync(artifactDirectory)) fs.mkdirpSync(artifactDirectory);

            if (version) {
                if (process.platform !== 'win32') {
                    cmd = `${defaultShell()} -e "${
                        this.scriptPath
                    }" "${packageName}" "${version}" "${artifactDirectory}"`;
                } else {
                    cmd = `cmd.exe /c "${this.scriptPath}" "${packageName}" "${version}" "${artifactDirectory}"`;
                }
            } else {
                if (process.platform !== 'win32') {
                    cmd = `${defaultShell()} -e ${this.scriptPath} ${packageName} ${artifactDirectory}`;
                } else {
                    cmd = `cmd.exe /c ${this.scriptPath} ${packageName} ${artifactDirectory}`;
                }
            }

            SFPLogger.log(`Fetching ${packageName} using ${cmd}`, LoggerLevel.INFO);

            child_process.execSync(cmd, {
                cwd: process.cwd(),
                stdio: 'pipe',
            });

            SFPLogger.log(`Successfully Fetched ${packageName}`, LoggerLevel.INFO);
        } catch (error) {
            if (!isToContinueOnMissingArtifact) throw error;
            else {
                SFPLogger.log(`Failed to execute script due to ${error.message}`, LoggerLevel.WARN);
                SFPLogger.log(
                    COLOR_WARNING(
                        `Artifact  for ${packageName} missing in  Registry provided, This might result in deployment failures`
                    )
                );
            }
        }
    }
}
