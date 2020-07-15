import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import PackageDiffImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/PackageDiffImpl';
import { exec } from "shelljs";
const fs = require("fs-extra");
import {isNullOrUndefined} from "util";
import { string } from '@oclif/command/lib/flags';
const path = require("path");

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
    projectdir: flags.directory({char: 'd', description: messages.getMessage('projectDirectoryFlagDescription')}),
    artifactdir: flags.directory({description: messages.getMessage('artifactDirectoryFlagDescription')}),
    diffcheck: flags.boolean({description: messages.getMessage('diffCheckFlagDescription')}),
    gittag: flags.boolean({description: messages.getMessage('gitTagFlagDescription')}),
    repourl: flags.string({char: 'r', description: messages.getMessage('repoUrlFlagDescription')}),
    refname: flags.string({description: messages.getMessage('refNameFlagDescription')})
  };


  public async run(){
    try {
      const sfdx_package: string = this.flags.package;
      const version_number: string = this.flags.versionnumber;
      const project_directory: string = this.flags.projectdir;
      const artifact_directory: string = this.flags.artifactdir;
      const refname: string = this.flags.refname;

      let runBuild: boolean;
      if (this.flags.diffcheck) {
        let packageDiffImpl = new PackageDiffImpl(sfdx_package, project_directory);

        runBuild = await packageDiffImpl.exec();

        if ( runBuild )
        console.log(`Detected changes to ${sfdx_package} package...proceeding\n`);
        else
        console.log(`No changes detected for ${sfdx_package} package...skipping\n`);

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


        let abs_artifact_directory: string;
        if (!isNullOrUndefined(project_directory)) {
          // Base artifact directory on the project directory
          if (!isNullOrUndefined(artifact_directory)) {
            abs_artifact_directory = path.resolve(project_directory, artifact_directory);
            fs.mkdirpSync(abs_artifact_directory);
          } else {
            abs_artifact_directory = path.resolve(project_directory);
          }
        } else {
          // Base artifact directory on the CWD
          if (!isNullOrUndefined(artifact_directory)) {
            abs_artifact_directory = path.resolve(artifact_directory);
            fs.mkdirpSync(abs_artifact_directory);
          } else {
            abs_artifact_directory = process.cwd();
          }
        }

        let artifactFilePath: string = path.join(
          abs_artifact_directory,
          `${sfdx_package}_artifact_metadata`
        );

        fs.writeFileSync(
          artifactFilePath,
          JSON.stringify(metadata)
        );
        console.log(`Created source package ${sfdx_package}_artifact_metadata`);

        if (this.flags.gittag) {
          exec(`git config --global user.email "sfpowerscripts@dxscale"`);
          exec(`git config --global user.name "sfpowerscripts"`);

          let tagname = `${sfdx_package}_v${version_number}`;
          console.log(`Creating tag ${tagname}`);
          exec(`git tag -a -m "${sfdx_package} Source Package ${version_number}" ${tagname} HEAD`, {silent:false});
        }

        console.log("\nOutput variables:");
        if (!isNullOrUndefined(refname)) {
          fs.writeFileSync('.env', `${refname}_sfpowerscripts_artifact_metadata_directory=${artifactFilePath}\n`, {flag:'a'});
          console.log(`${refname}_sfpowerscripts_artifact_metadata_directory=${artifactFilePath}`);
          fs.writeFileSync('.env', `${refname}_sfpowerscripts_package_version_number=${version_number}\n`, {flag:'a'});
          console.log(`${refname}_sfpowerscripts_package_version_number=${version_number}`);
        } else {
          fs.writeFileSync('.env', `sfpowerscripts_artifact_metadata_directory=${artifactFilePath}\n`, {flag:'a'});
          console.log(`sfpowerscripts_artifact_metadata_directory=${artifactFilePath}`);
          fs.writeFileSync('.env', `sfpowerscripts_package_version_number=${version_number}\n`, {flag:'a'});
          console.log(`sfpowerscripts_package_version_number=${version_number}`);
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
