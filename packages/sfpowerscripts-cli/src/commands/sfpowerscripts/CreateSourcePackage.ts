import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import PackageDiffImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/PackageDiffImpl';
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
    projectdir: flags.string({char: 'd', description: messages.getMessage('projectDirectoryFlagDescription')}),
    diffcheck: flags.boolean({description: messages.getMessage('diffCheckFlagDescription')}),
    gittag: flags.boolean({description: messages.getMessage('gitTagFlagDescription')}),
    repourl: flags.string({char: 'r', description: messages.getMessage('repoUrlFlagDescription')}),
    refname: flags.string({description: messages.getMessage('refNameFlagDescription')})
  };


  public async run(){
    try {
      let sfdx_package: string = this.flags.package;
      let version_number: string = this.flags.versionnumber;
      let project_directory: string = this.flags.projectdir;

      let runBuild: boolean;
      if (this.flags.diffcheck) {
        let packageDiffImpl = new PackageDiffImpl(sfdx_package, project_directory);

        runBuild = await packageDiffImpl.exec();

        if ( runBuild )
        console.log(`Detected changes to ${sfdx_package} package...proceeding`);
        else
        console.log(`No changes detected for ${sfdx_package} package...skipping`);

      } else runBuild = true;

      if (runBuild) {
        let commit_id = exec('git log --pretty=format:\'%H\' -n 1', {silent:true});

        let repository_url: string;
        if (isNullOrUndefined(this.flags.repourl)) {
          repository_url = exec('git config --get remote.origin.url', {silent:true});
          // Remove new line '\n' from end of url
          repository_url = repository_url.slice(0,repository_url.length - 1);
        } else repository_url = this.flags.repourl;

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
        console.log(`Created source package ${sfdx_package}_artifact_metadata`);

        if (this.flags.gittag) {
          exec(`git config --global user.email "sfpowerscripts@dxscale"`);
          exec(`git config --global user.name "sfpowerscripts"`);

          let tagname = `${sfdx_package}_v${version_number}`;
          console.log(`Creating tag ${tagname}`);
          exec(`git tag -a -m "${sfdx_package} Source Package ${version_number}" ${tagname} HEAD`, {silent:false});
        }

        if (!isNullOrUndefined(this.flags.refname)) {
          console.log("\nOutput variables:");
          fs.writeFileSync('.env', `${this.flags.refname}_sfpowerscripts_artifact_metadata_directory=${process.env.PWD}/${sfdx_package}_artifact_metadata\n`, {flag:'a'});
          console.log(`${this.flags.refname}_sfpowerscripts_artifact_metadata_directory`);
          fs.writeFileSync('.env', `${this.flags.refname}_sfpowerscripts_package_version_number=${version_number}\n`, {flag:'a'});
          console.log(`${this.flags.refname}_sfpowerscripts_package_version_number`);
        } else {
          console.log("\nOutput variables:");
          fs.writeFileSync('.env', `sfpowerscripts_artifact_metadata_directory=${process.env.PWD}/${sfdx_package}_artifact_metadata\n`, {flag:'a'});
          console.log(`sfpowerscripts_artifact_metadata_directory`);
          fs.writeFileSync('.env', `sfpowerscripts_package_version_number=${version_number}\n`, {flag:'a'});
          console.log(`sfpowerscripts_package_version_number`);
        }

        // AppInsights.trackTask("sfpwowerscripts-createsourcepackage-task");
        // AppInsights.trackTaskEvent("sfpwowerscripts-createsourcepackage-task","source_package_created");
      }
    } catch (err) {
      // AppInsights.trackExcepiton("sfpwowerscripts-createsourcepackage-task",err);
      console.log(err);
      // Fail the task when an error occurs
      process.exit(1);
    }
  }
}
