import { SFDXCommand } from '../command/SFDXCommand';
import { Logger, LoggerLevel } from '../logger/SFPLogger';

export default class ApexLinkCheckImpl extends SFDXCommand {
    public constructor(
        working_directory: string,
        logger: Logger,
        logLevel: LoggerLevel
    ) {
        super(null, working_directory, logger, logLevel);
    }

    getSFDXCommand(): string {
        return 'sfdx apexlink:check';
    }
    getCommandName(): string {
        return 'apexlink:check';
    }

    getGeneratedParams(): string {
        let command = `--depends`;
        return command;
    }
}
