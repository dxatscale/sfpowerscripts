import TransitiveDependencyResolver from '@dxatscale/sfpowerscripts.core/lib/dependency/TransitiveDependencyResolver';
import { Messages } from '@salesforce/core';
import SfpowerscriptsCommand from '../../../SfpowerscriptsCommand';
import ProjectConfig from '@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig';
import { flags } from '@salesforce/command';
import SFPOrg from '@dxatscale/sfpowerscripts.core/lib/org/SFPOrg';
import * as fs from 'fs-extra';
import path = require('path');
import * as rimraf from 'rimraf';
import { Stage } from '../../../impl/Stage';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'expand_dependency');

export default class Expand extends SfpowerscriptsCommand {
    public static description = messages.getMessage('commandDescription');

    protected static requiresUsername = false;
    protected static requiresDevhubUsername = false;
    protected static requiresProject = false;

    protected static flagsConfig = {
        devhubalias: flags.string({
            char: 'v',
            description: messages.getMessage('devhubAliasFlagDescription'),
            default: 'HubOrg',
        }),
        overwrite: flags.boolean({
            char: 'o',
            description: messages.getMessage('overWriteProjectConfigFlagDescription'),
            default: false,
        }),
        loglevel: flags.enum({
            description: 'logging level for this command invocation',
            default: 'info',
            required: false,
            options: [
                'trace',
                'debug',
                'info',
                'warn',
                'error',
                'fatal',
                'TRACE',
                'DEBUG',
                'INFO',
                'WARN',
                'ERROR',
                'FATAL',
            ],
        }),
    };

    public async execute() {
        let sfpOrg: SFPOrg;
        let defaultProjectConfigPath = './project-config';
        let projectConfigFilePath: string;
        if (this.flags.devhubalias) sfpOrg = await SFPOrg.create({ aliasOrUsername: this.flags.devhubalias });
        try {
            //Validate dependencies in sfdx-project.json // Read Manifest
            let projectConfig = ProjectConfig.getSFDXProjectConfig(process.cwd());
            const transitiveDependencyResolver = new TransitiveDependencyResolver(
                projectConfig,
                sfpOrg.getConnection()
            );
            projectConfig = await transitiveDependencyResolver.resolveDependencies(Stage.EXPAND);

            //Clean up temp directory
            if (!fs.existsSync(defaultProjectConfigPath)) fs.mkdirpSync(defaultProjectConfigPath);

            if(this.flags.overwrite){
                console.log(`Overwriting sfdx-project.json with expanded project config file`);
                projectConfigFilePath = `sfdx-project.json`;
                fs.writeFileSync(projectConfigFilePath, JSON.stringify(projectConfig, null, 4));
                console.log('sfdx-project.json has been updated.')
            }else{
                projectConfigFilePath = path.join(defaultProjectConfigPath, `sfdx-project.exp.json`);
                fs.writeFileSync(projectConfigFilePath, JSON.stringify(projectConfig, null, 4));
                console.log(`Generated project config file has been saved to ${projectConfigFilePath}`);
            }

        } catch (error) {
            throw new Error('Unable to generate project config file:' + error);
        }
    }
}
