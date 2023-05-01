import Command from '@oclif/command';
import { OutputArgs, OutputFlags } from '@oclif/parser';
import SFPlogger, { COLOR_HEADER } from '@dxatscale/sfp-logger/lib/SFPLogger';
import path = require('path');
import { SfpProjectConfig } from './types/SfpProjectConfig';
import * as fs from 'fs-extra';
const pjson = require('../package.json');

export default abstract class SfpCommand extends Command {
    // The parsed flags for easy reference by this command; assigned in init
    protected flags: OutputFlags<any>;

    // The parsed args for easy reference by this command; assigned in init
    protected args: OutputArgs;

    protected varargs?: any;
    protected projectName: string;
    protected sfpProjectConfig: SfpProjectConfig;

    // TypeScript does not yet have assertion-free polymorphic access to a class's static side from the instance side
    protected get statics() {
        return this.constructor as typeof SfpCommand;
    }

    public async run<T>(): Promise<T> {
        await this.init();
        if (this.args.caller !== 'inner') {
            SFPlogger.log(
                COLOR_HEADER(
                    `sfp cli -- The DX@Scale Dev CLI -Version:${this.config.version} -Release:${pjson.release}`
                )
            );
        }

        this.projectName = `${path.basename(process.cwd())}`;

        let jsonObj;
        let pathToSfpProjectConfig = path.join(this.config.configDir, `${this.projectName}.json`);
        if (fs.existsSync(pathToSfpProjectConfig)) {
            jsonObj = fs.readJsonSync(pathToSfpProjectConfig);
        } else {
            jsonObj = {};
        }

        this.sfpProjectConfig = SfpProjectConfig.toInstance(jsonObj);

        return this.exec();
    }

    protected async init(): Promise<void> {
        const { args, flags } = this.parse({
            flags: this.statics.flags,
            args: this.statics.args,
        });

        this.flags = flags;
        this.args = args;
    }

    /**
     * Actual command run code goes here
     */
    protected abstract exec(): Promise<any>;
}
