import { Messages } from "@salesforce/core";
import SfpowerscriptsCommand from '../../../../SfpowerscriptsCommand';
import { flags } from '@salesforce/command';

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

    }
    catch (err){
      console.log(err);
      process.exit(1);
    }
  }
}