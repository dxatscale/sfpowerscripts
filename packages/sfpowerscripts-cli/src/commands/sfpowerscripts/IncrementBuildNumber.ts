import IncrementProjectBuildNumberImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/IncrementProjectBuildNumberImpl';
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
const fs = require("fs");
import child_process = require("child_process");

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'increment_build_number');

export default class IncrementBuildNumber extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `sfdx IncrementBuildNumber --segment BuildNumber -n packagename -c 
  `
  ];


  protected static flagsConfig = {
    segment: flags.string({description: messages.getMessage('segmentFlagDescription'), options: ['Major', 'Minor', 'Patch', 'BuildNumber'], default: 'BuildNumber'}),
    appendbuildnumber: flags.boolean({char: 'a', description: messages.getMessage('appendBuildNumberFlagDescription'), dependsOn: ['runnumber'] ,exclusive: ['segment', 'commitchanges']}),
    package: flags.string({char: 'n', description: messages.getMessage('packageFlagDescription')}),
    projectdir: flags.string({char: 'd', description: messages.getMessage('projectDirectoryFlagDescription')}),
    commitchanges: flags.boolean({char: 'c', description: messages.getMessage('commitChangesFlagDescription')}),
    refname: flags.string({required: true, description: messages.getMessage('refNameFlagDescription')}),
    runnumber: flags.string({char: 'r', description: messages.getMessage('runNumberFlagDescription'), dependsOn: ['appendbuildnumber']})
  };

  protected static requiresProject = true;
  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  public async run(){
    try {
      const segment: string = this.flags.segment;
      const sfdx_package: string = this.flags.package;
      let project_directory: string = this.flags.projectdir;
      const appendBuildNumber: boolean = this.flags.appendbuildnumber;
      const commit_changes: boolean = this.flags.commitchanges;
  
      // AppInsights.setupAppInsights(tl.getBoolInput("isTelemetryEnabled",true));
     
      const runNumber: string = this.flags.runnumber; 
  
      let incrementProjectBuildNumberImpl: IncrementProjectBuildNumberImpl = new IncrementProjectBuildNumberImpl(
        project_directory,
        sfdx_package,
        segment,
        appendBuildNumber,
        runNumber
      );
  
      let version_number: string = await incrementProjectBuildNumberImpl.exec();
  
  
      fs.writeFileSync('.env', `${this.flags.refname}_sfpowerscripts_incremented_project_version=${version_number}\n`, {flag:'a'});
  
      let repo_localpath = process.env.PWD;
    
  
      if(!appendBuildNumber && commit_changes)
      {
  
        child_process.execSync(" git config user.email sfpowerscripts@dxscale");
        child_process.execSync(" git config user.name sfpowerscripts");
        
      
        console.log("Committing to Git");
        let exec_result = child_process.execSync("git add sfdx-project.json", {
          cwd: repo_localpath}
        );
       
        console.log(exec_result.toString());
    
        exec_result = child_process.execSync(
          `git commit  -m "[skip ci] Updated Version "`,
          { cwd: repo_localpath }
        );
        console.log(exec_result.toString());
      }
      
      
  
    // AppInsights.trackTask("sfpwowerscript-incrementversionnumber-task");
    // AppInsights.trackTaskEvent("sfpwowerscript-incrementversionnumber-task","project_version_incremented");    
      
    } catch (err) {
      // AppInsights.trackExcepiton("sfpwowerscript-incrementversionnumber-task",err);    
      console.log(err);
  
      process.exit(1);
    }
  }
}
