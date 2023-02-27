import SfpCommand from '../SfpCommand';
import Init from '../commands/init';
import path = require('path');
import * as fs from 'fs-extra';
import { SfpProjectConfig } from '../types/SfpProjectConfig';
import SFPLogger, { LoggerLevel } from '@dxatscale/sfp-logger/lib/SFPLogger';

export default abstract class CommandsWithInitCheck extends SfpCommand {
    async exec() {
        if (!SfpProjectConfig.isValid(this.sfpProjectConfig)) {
            SFPLogger.log('Project not initialized yet, Initializing...', LoggerLevel.WARN);

            let args = new Array<string>();
            args.push('inner');
            let init: Init = new Init(args, this.config);
            await init.run();
            this.sfpProjectConfig = SfpProjectConfig.toInstance(
                await fs.readJSON(path.join(this.config.configDir, `${this.projectName}.json`))
            );
        }
        return this.executeCommand();
    }

    protected abstract executeCommand(): Promise<any>;
}
