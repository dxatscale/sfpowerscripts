import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import {exec} from "shelljs";
const fs = require("fs");
import {isNullOrUndefined} from "util"

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'create_source_package');

export default class CreateSourcePackage extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `sfdx sfpowerscripts:CreateSourcePackage -n packagename -v 1.5.10\n` +
  `Output variable:\n` +
  `sfpowerscripts_artifact_metadata_directory\n` +
  `<refname>_sfpowerscripts_artifact_metadata_directory`
  ];

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;
  
  protected static flagsConfig = {
    package: flags.string({required: true, char: 'n', description: messages.getMessage('packageFlagDescription')}),
    versionnumber: flags.string({required: true, char: 'v', description: messages.getMessage('versionNumberFlagDescription')}),
    refname: flags.string({description: messages.getMessage('refNameFlagDescription')})
  };


  public async run(){
    try {
      let sfdx_package: string = this.flags.package;
      let version_number: string = this.flags.versionnumber;
      let commit_id = exec('git log --pretty=format:\'%H\' -n 1', {silent:true});
  
      let repository_url: string = 
        exec('git config --get remote.origin.url', {silent:true});
        // Remove new line '\n' from end of url
        repository_url = repository_url.slice(0,repository_url.length - 1);
  
  
      // AppInsights.setupAppInsights(tl.getBoolInput("isTelemetryEnabled",true));
  
        
      let metadata = {
        package_name: sfdx_package,
        package_version_number: version_number,
        sourceVersion: commit_id,
        repository_url:repository_url,
        package_type:"source"
      };
  
      let artifactFileName:string = `/${sfdx_package}_artifact_metadata`;
  
      fs.writeFileSync(process.env.PWD + artifactFileName, JSON.stringify(metadata));
      
      if (!isNullOrUndefined(this.flags.refname)) {
        fs.writeFileSync('.env', `${this.flags.refname}_sfpowerscripts_artifact_metadata_directory=${process.env.PWD}/${sfdx_package}_artifact_metadata\n`, {flag:'a'});
      } else {
        fs.writeFileSync('.env', `sfpowerscripts_artifact_metadata_directory=${process.env.PWD}/${sfdx_package}_artifact_metadata\n`, {flag:'a'});
      }
      // AppInsights.trackTask("sfpwowerscripts-createsourcepackage-task");
      // AppInsights.trackTaskEvent("sfpwowerscripts-createsourcepackage-task","source_package_created");
  
  
    } catch (err) {
      // AppInsights.trackExcepiton("sfpwowerscripts-createsourcepackage-task",err);

      console.log(err);

      // Fail the task when an error occurs
      process.exit(1);
    }
  }
}
