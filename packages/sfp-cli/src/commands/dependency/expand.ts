import TransitiveDependencyResolver from '../../core/package/dependencies/TransitiveDependencyResolver';
import { Messages } from '@salesforce/core';
import SfpCommand from '../../SfpCommand';
import ProjectConfig from '../../core/project/ProjectConfig';
import SFPLogger, { LoggerLevel, Logger } from '@flxblio/sfp-logger';
import * as fs from 'fs-extra';
import path = require('path');
import UserDefinedExternalDependency from "../../core/project/UserDefinedExternalDependency";
import { Flags } from '@oclif/core';
import { loglevel, targetdevhubusername } from '../../flags/sfdxflags';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@flxblio/sfp', 'dependency_expand');

export default class Expand extends SfpCommand {
    public static description = messages.getMessage('commandDescription');


    protected static requiresDevhubUsername = true;
    protected static requiresProject = true;

    public static flags = {
        targetdevhubusername,
        overwrite: Flags.boolean({
            char: 'o',
            description: messages.getMessage('overWriteProjectConfigFlagDescription'),
            default: false,
        }),
        loglevel
    };

    public async execute() {
        let defaultProjectConfigPath = './project-config';
        let projectConfigFilePath: string;
        try {
            //Validate dependencies in sfdx-project.json // Read Manifest
            let projectConfig = ProjectConfig.getSFDXProjectConfig(process.cwd());
            const transitiveDependencyResolver = new TransitiveDependencyResolver(
                projectConfig
            );

            
            let resolvedDependencyMap =  await transitiveDependencyResolver.resolveTransitiveDependencies();
            projectConfig = await ProjectConfig.updateProjectConfigWithDependencies(projectConfig,resolvedDependencyMap);
            projectConfig = await (new UserDefinedExternalDependency()).addDependencyEntries(projectConfig, this.hubOrg.getConnection());

            //Clean up temp directory
            if (!fs.existsSync(defaultProjectConfigPath)) fs.mkdirpSync(defaultProjectConfigPath);

            if(this.flags.overwrite){
                SFPLogger.log(`Overwriting sfdx-project.json with expanded project config file`,LoggerLevel.INFO)
                projectConfigFilePath = `sfdx-project.json`;

                let backupFilePath: string = path.join(defaultProjectConfigPath, `sfdx-project.json.bak`);
                SFPLogger.log(`Saving a backup to ${backupFilePath}`,LoggerLevel.INFO)
                fs.copySync(projectConfigFilePath, backupFilePath);
                
                fs.writeFileSync(projectConfigFilePath, JSON.stringify(projectConfig, null, 4));
                SFPLogger.log('sfdx-project.json has been updated.',LoggerLevel.INFO)
            }else{
                projectConfigFilePath = path.join(defaultProjectConfigPath, `sfdx-project.exp.json`);
                fs.writeFileSync(projectConfigFilePath, JSON.stringify(projectConfig, null, 4));
                SFPLogger.log(`Generated project config file has been saved to ${projectConfigFilePath}`,LoggerLevel.INFO)
            }

        } catch (error) {
            throw new Error('Unable to generate project config file:' + error);
        }
    }
}
