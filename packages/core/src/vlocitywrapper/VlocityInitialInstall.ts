import { SFDXCommand } from '@dxatscale/sfdx-process-wrapper/lib/SFDXCommand';
import { Logger, LoggerLevel } from '@dxatscale/sfp-logger';

export default class VlocityInitialInstall extends SFDXCommand {
    public constructor(project_directory: string, target_org: string, logger: Logger, logLevel: LoggerLevel) {
        super(target_org, project_directory, logger, logLevel);
    }

    getSFDXCommand(): string {
        return 'vlocity';
    }
    getCommandName(): string {
        return 'vlocity:packUpdateSettings';
    }

    getGeneratedParams(): string {
        let command = `-sfdx.username ${this.target_org} --nojob installVlocityInitial`;
        if (this.logLevel) command += ` -verbose`;
        return command;
    }
}
