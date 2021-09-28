import IncrementProjectBuildNumberImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/IncrementProjectBuildNumberImpl';
import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
const fs = require("fs");
import { ConsoleLogger } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger"
import simplegit from "simple-git";
import GitIdentity from "../../../../impl/git/GitIdentity";

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'increment_build_number');

export default class IncrementBuildNumber extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `$ sfdx sfpowerscripts:package:version:increment --segment BuildNumber -n packagename -c\n`,
  `Output variable:`,
  `sfpowerscripts_incremented_project_version`,
  `<refname>_sfpowerscripts_incremented_project_version`
  ];


  protected static flagsConfig = {
    segment: flags.string({description: messages.getMessage('segmentFlagDescription'), options: ['Major', 'Minor', 'Patch', 'BuildNumber'], default: 'BuildNumber'}),
    appendbuildnumber: flags.boolean({char: 'a', description: messages.getMessage('appendBuildNumberFlagDescription'), dependsOn: ['runnumber'] ,exclusive: ['segment', 'commitchanges']}),
    package: flags.string({char: 'n', description: messages.getMessage('packageFlagDescription')}),
    projectdir: flags.string({char: 'd', description: messages.getMessage('projectDirectoryFlagDescription')}),
    commitchanges: flags.boolean({char: 'c', description: messages.getMessage('commitChangesFlagDescription')}),
    refname: flags.string({description: messages.getMessage('refNameFlagDescription')}),
    runnumber: flags.string({char: 'r', description: messages.getMessage('runNumberFlagDescription'), dependsOn: ['appendbuildnumber']}),
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

      const segment: string = this.flags.segment;
      const sfdx_package: string = this.flags.package;
      let project_directory: string = this.flags.projectdir;
      const appendBuildNumber: boolean = this.flags.appendbuildnumber;
      const commit_changes: boolean = this.flags.commitchanges;

      const runNumber: string = this.flags.runnumber;

      let incrementProjectBuildNumberImpl: IncrementProjectBuildNumberImpl = new IncrementProjectBuildNumberImpl(
        new ConsoleLogger(),
        project_directory,
        sfdx_package,
        segment,
        appendBuildNumber,
        runNumber
      );

      let result:{status:boolean,ignore:boolean,versionNumber:string} = await incrementProjectBuildNumberImpl.exec();

      console.log("\nOutput variables:");
      if (this.flags.refname) {
        fs.writeFileSync('.env', `${this.flags.refname}_sfpowerscripts_incremented_project_version=${result.versionNumber}\n`, {flag:'a'});
        console.log(`${this.flags.refname}_sfpowerscripts_incremented_project_version=${result.versionNumber}`);
      } else {
        fs.writeFileSync('.env', `sfpowerscripts_incremented_project_version=${result.versionNumber}\n`, {flag:'a'});
        console.log(`sfpowerscripts_incremented_project_version=${result.versionNumber}`);
      }

      if(!appendBuildNumber && commit_changes && !result.ignore)
      {
        let git = simplegit();

        await new GitIdentity(git).setUsernameAndEmail();
        await git.add(['sfdx-project.json']);
        await git.commit('[skip ci] Updated Version');
      }


    } catch (err) {
      console.log(err);
      process.exit(1);
    }
  }
}
