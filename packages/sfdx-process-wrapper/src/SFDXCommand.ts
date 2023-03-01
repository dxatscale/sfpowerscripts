import ExecuteCommand from './commandExecutor/ExecuteCommand';
import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';

export abstract class SFDXCommand {
    public constructor(
        protected target_org: string,
        protected project_directory: string,
        protected logger?: Logger,
        protected logLevel?: LoggerLevel
    ) {}

    public async exec(quiet:boolean = true, timeout: number = 0, showProgress: boolean = false): Promise<any> {
        let command = this.getSFDXCommand();
        //add log level to error
        command += ' --loglevel=ERROR';
        
        if (quiet) command += ` --json`;
        command += ' ' + this.getGeneratedParams();

        SFPLogger.log('Generated Command:' + command, LoggerLevel.TRACE, this.logger);
        let executor: ExecuteCommand = new ExecuteCommand(this.logger, this.logLevel, showProgress);
        //CLI writes errors to Output Stream during errors in JSON Mode, so if quiet is true, use swap output for error
        let output = await executor.execCommand(command, this.project_directory, timeout, quiet);
        if (quiet) {
            return JSON.parse(output).result;
        }
        return output;
    }

    public getGeneratedSFDXCommandWithParams() {
        let command = this.getSFDXCommand();
        command += ' ' + this.getGeneratedParams();
        return command;
    }

    abstract getSFDXCommand(): string;
    abstract getCommandName(): string;
    abstract getGeneratedParams(): string;
}
