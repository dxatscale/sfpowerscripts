import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import CreateDeltaPackageImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/CreateDeltaPackageImpl';
import {isNullOrUndefined} from "util";
import {exec} from "shelljs";
const path = require("path");
const fs = require("fs-extra");

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'create_delta_package');

export default class CreateDeltaPackage extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `sfdx sfpowerscripts:CreateDeltaPackage -n packagename -r 61635fb -t 3cf01b9 -v 1.2.10 -b\n` +
  `Output variable:\n` +
  `sfpowerscripts_delta_package_path\n` +
  `<refname>_sfpowerscripts_delta_package_path\n` +
  `sfpowerscripts_artifact_metadata_directory\n` +
  `<refname>_sfpowerscripts_artifact_metadata_directory`
  ];

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  protected static flagsConfig = {
    package: flags.string({required: true , char: 'n', description: messages.getMessage('packageNameFlagDescription')}),
    revisionfrom: flags.string({required: true, char: 'r', description: messages.getMessage('revisionFromFlagDescription')}),
    revisionto : flags.string({char: 't', description: messages.getMessage('revisionToFlagDescription'), default: 'HEAD'}),
    versionname: flags.string({required: true, char: 'v', description: messages.getMessage('versionNameFlagDescription')}),
    buildartifactenabled : flags.boolean({char: 'b', description: messages.getMessage('buildArtifactEnabledFlagDescription')}),
    repourl: flags.string({description: messages.getMessage('repoUrlFlagDescription')}),
    projectdir: flags.directory({char: 'd', description: messages.getMessage('projectDirectoryFlagDescription')}),
    artifactdir: flags.directory({description: messages.getMessage('artifactDirectoryFlagDescription')}),
    generatedestructivemanifest: flags.boolean({char: 'x', description: messages.getMessage('generateDestructiveManifestFlagDescription')}),
    bypassdirectories: flags.string({description: messages.getMessage('bypassDirectoriesFlagDescription')}),
    onlydifffor: flags.string({description: messages.getMessage('onlyDiffForFlagDescription')}),
    refname: flags.string({description: messages.getMessage('refNameFlagDescription')})
  };


  public async run(){
    try {
      const sfdx_package = this.flags.package;
      const projectDirectory = this.flags.projectdir;
      const artifactDirectory = this.flags.artifactdir;
      const versionName: string = this.flags.versionname;
      const refname: string = this.flags.refname;

      let revisionFrom: string = this.flags.revisionfrom;
      let revision_to: string = this.flags.revisionto;
      let options:any = {};

      options['bypass_directories']= this.flags.bypassdirectories;
      options['only_diff_for']= this.flags.onlydifffor;

      const generate_destructivemanifest = this.flags.generatedestructivemanifest;
      const build_artifact_enabled = this.flags.buildartifactenabled;

      // AppInsights.setupAppInsights(tl.getBoolInput("isTelemetryEnabled", true));

      let createDeltaPackageImp = new CreateDeltaPackageImpl(
        projectDirectory,
        sfdx_package,
        revisionFrom,
        revision_to,
        generate_destructivemanifest,
        options
      );
      let command = await createDeltaPackageImp.buildExecCommand();
      console.log(`Package Creation Command: ${command}`);

      await createDeltaPackageImp.exec(command);

      let deltaPackageFilePath = path.join(
        projectDirectory ? projectDirectory : process.cwd(),
        `${sfdx_package}_src_delta`
      );

      if (!isNullOrUndefined(refname)) {
        fs.writeFileSync('.env', `${refname}_sfpowerscripts_delta_package_path=${deltaPackageFilePath}\n`, {flag:'a'});
      } else {
        fs.writeFileSync('.env', `sfpowerscripts_delta_package_path=${deltaPackageFilePath}\n`, {flag:'a'});
      }

      if (build_artifact_enabled) {
        // Write artifact metadata

        let repository_url: string;
        if (isNullOrUndefined(this.flags.repourl)) {
          repository_url = exec('git config --get remote.origin.url', {silent:true});
          // Remove new line '\n' from end of url
          repository_url = repository_url.slice(0,repository_url.length - 1);
        } else repository_url = this.flags.repourl;

        let commit_id = exec('git log --pretty=format:\'%H\' -n 1', {silent:true});

        let metadata = {
          package_name: sfdx_package,
          sourceVersion: commit_id,
          repository_url: repository_url,
          package_type: "delta",
          package_version_name: versionName
        };


        let absArtifactDirectory: string;
        if (!isNullOrUndefined(projectDirectory)) {
          // Base artifact directory on the project directory
          if (!isNullOrUndefined(artifactDirectory)) {
            absArtifactDirectory = path.resolve(projectDirectory, artifactDirectory);
            fs.mkdirpSync(absArtifactDirectory);
          } else {
            absArtifactDirectory = path.resolve(projectDirectory);
          }
        } else {
          // Base artifact directory on the CWD
          if (!isNullOrUndefined(artifactDirectory)) {
            absArtifactDirectory = path.resolve(artifactDirectory);
            fs.mkdirpSync(absArtifactDirectory);
          } else {
            absArtifactDirectory = process.cwd();
          }
        }

        let artifactFilePath: string = path.join(
          absArtifactDirectory,
          `${sfdx_package}_artifact_metadata`
        );

        fs.writeFileSync(
          artifactFilePath,
          JSON.stringify(metadata)
        );

        console.log("\nOutput variables:");
        if (!isNullOrUndefined(refname)) {
          fs.writeFileSync('.env', `${refname}_sfpowerscripts_artifact_metadata_directory=${artifactFilePath}\n`, {flag:'a'});
          console.log(`${refname}_sfpowerscripts_artifact_metadata_directory=${artifactFilePath}`);
        } else {
          fs.writeFileSync('.env', `sfpowerscripts_artifact_metadata_directory=${artifactFilePath}\n`, {flag:'a'});
          console.log(`sfpowerscripts_artifact_metadata_directory=${artifactFilePath}`);
        }
      }
    } catch (err) {
      console.log(err);
      // Fail the task when an error occurs
      process.exit(1);
    }
  }
}
