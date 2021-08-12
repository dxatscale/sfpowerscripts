import { Messages } from "@salesforce/core";
import SfpowerscriptsCommand from '../../../../SfpowerscriptsCommand';
import { flags } from '@salesforce/command';
import fs = require("fs");
import inquirer = require("inquirer");
import { cli } from "cli-ux";

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'manage_versions');

export default class ManageVersions extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `sfdx sfdxpowerscripts:package:version:manage`
  ];

  protected static flagsConfig = {
    
    loglevel: flags.enum({
      description: "logging level for this command invocation",
      default: "info",
      required: false,
      options: [
        "trace",
        "debug",
        "info",
        "warn",
        "error",
        "fatal",
        "TRACE",
        "DEBUG",
        "INFO",
        "WARN",
        "ERROR",
        "FATAL",
      ],
    })
  }; 

  protected static requiresProject = true; 
  protected static requiresUsername = false; 
  protected static requiresDevhubUsername = false; 

  public async execute(){
    try {
      const projectConfig = JSON.parse(
        fs.readFileSync("sfdx-project.json", "utf8")
      );
      
      let packages = projectConfig.packageDirectories; 
      console.log(`The sfdx-project.json contains the packages and dependencies:\n`);
      for(let pkg of packages){
        console.log(`${pkg.package} verion number: ${pkg.versionNumber}`)
        
        

        await inquirer.prompt([{type: 'list', name: 'selection', message: `Would you like to update ${pkg.package}?`, choices: ['Major', 'Minor', 'Patch', 'Skip']}]).then((answers) => {});
        console.log(`\n`)

        if(pkg.dependencies != undefined){
          console.log(`Dependencies for ${pkg.package}:`);
          let dependencies = pkg.dependencies;
          for(let dependency of dependencies){
            if(dependency.versionNumber != undefined){
              console.log(`${dependency.package} has VersionNumber ${dependency.versionNumber}`)
            }
          }
        }else{
          console.log(`No dependencies found for ${pkg.package}`);
        }
        
      }
    }
    catch (err){
      console.log(err);
      process.exit(1);
    }
  }
}