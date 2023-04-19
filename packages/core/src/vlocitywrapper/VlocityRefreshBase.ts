import path from 'path';
import { SFDXCommand } from '@dxatscale/sfdx-process-wrapper/lib/SFDXCommand';
import { Logger, LoggerLevel } from '@dxatscale/sfp-logger';

export default class VlocityRefreshBase extends SFDXCommand {
    public constructor(
        project_directory: string,
        target_org: string,
        private packageDirectory: string,
        logger: Logger,
        logLevel: LoggerLevel
    ) {
        super(target_org, project_directory, logger, logLevel);
    }

    getSFDXCommand(): string {
        return 'vlocity';
    }
    getCommandName(): string {
        return 'vlocity:refreshVlocityBase';
    }

    getGeneratedParams(): string {
        let command = `-sfdx.username ${this.target_org} -job ${path.join(
            this.packageDirectory,
            'VlocityComponents.yaml'
        )}  refreshVlocityBase`;
        if (this.logLevel) command += ` -verbose`;
        return command;
    }
}
