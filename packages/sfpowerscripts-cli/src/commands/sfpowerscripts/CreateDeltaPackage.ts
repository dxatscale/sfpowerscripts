import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import CreateDeltaPackageImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/CreateDeltaPackageImpl';
import {isNullOrUndefined} from "util";
import {exec} from "shelljs";
const path = require("path");
const fs = require("fs-extra");
const dotenv = require('dotenv').config();

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'create_delta_package');

export default class CreateDeltaPackage extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:CreateDeltaPackage -n <packagename> -r <61635fb> -t <3cf01b9> -v <version> -b\n`,
    `Output variable:`,
    `sfpowerscripts_delta_package_path`,
    `<refname>_sfpowerscripts_delta_package_path`,
    `sfpowerscripts_artifact_metadata_directory`,
    `<refname>_sfpowerscripts_artifact_metadata_directory`,
    `sfpowerscripts_artifact_directory`,
    `<refname>_sfpowerscripts_artifact_directory`
  ];

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  protected static flagsConfig = {
    package: flags.string({required: true , char: 'n', description: messages.getMessage('packageNameFlagDescription')}),
    revisionfrom: flags.string({required: true, char: 'r', description: messages.getMessage('revisionFromFlagDescription')}),
    revisionto : flags.string({char: 't', description: messages.getMessage('revisionToFlagDescription'), default: 'HEAD'}),
    versionname: flags.string({required: true, char: 'v', description: messages.getMessage('versionNameFlagDescription')}),
    buildartifactenabled : flags.boolean({char: 'b', description: messages.getMessage('buildArtifactEnabledFlagDescription'), default: true}),
    repourl: flags.string({description: messages.getMessage('repoUrlFlagDescription')}),
    projectdir: flags.directory({char: 'd', description: messages.getMessage('projectDirectoryFlagDescription')}),
    artifactdir: flags.directory({description: messages.getMessage('artifactDirectoryFlagDescription'), default: 'artifacts'}),
    generatedestructivemanifest: flags.boolean({char: 'x', description: messages.getMessage('generateDestructiveManifestFlagDescription')}),
    bypassdirectories: flags.string({description: messages.getMessage('bypassDirectoriesFlagDescription')}),
    onlydifffor: flags.string({description: messages.getMessage('onlyDiffForFlagDescription')}),
    refname: flags.string({description: messages.getMessage('refNameFlagDescription')})
  };


  public async run(){
    try {
      this.loadSfpowerscriptsVariables(this.flags);

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
          absArtifactDirectory = path.resolve(
            projectDirectory,
            artifactDirectory
          );
        } else {
          absArtifactDirectory = path.resolve(artifactDirectory);
        }

        let sfdx_package_artifact: string = path.join(
          absArtifactDirectory,
          `${sfdx_package}_artifact`
        );
        fs.mkdirpSync(sfdx_package_artifact);

        let sourcePackage: string = path.join(
          sfdx_package_artifact,
          `${sfdx_package}_sfpowerscripts_source_package`
        );
        fs.mkdirpSync(sourcePackage);
        fs.copySync(deltaPackageFilePath, sourcePackage);

        let artifactMetadataFilePath: string = path.join(
          sfdx_package_artifact,
          `${sfdx_package}_artifact_metadata`
        );

        fs.writeFileSync(
          artifactMetadataFilePath,
          JSON.stringify(metadata)
        );

        console.log("\nOutput variables:");
        if (!isNullOrUndefined(refname)) {
          fs.writeFileSync('.env', `${refname}_sfpowerscripts_artifact_metadata_directory=${artifactMetadataFilePath}\n`, {flag:'a'});
          console.log(`${refname}_sfpowerscripts_artifact_metadata_directory=${artifactMetadataFilePath}`);
          fs.writeFileSync('.env', `${refname}_sfpowerscripts_artifact_directory=${sfdx_package_artifact}\n`, {flag:'a'});
          console.log(`${refname}_sfpowerscripts_artifact_directory=${sfdx_package_artifact}`);
        } else {
          fs.writeFileSync('.env', `sfpowerscripts_artifact_metadata_directory=${artifactMetadataFilePath}\n`, {flag:'a'});
          console.log(`sfpowerscripts_artifact_metadata_directory=${artifactMetadataFilePath}`);
          fs.writeFileSync('.env', `sfpowerscripts_artifact_directory=${sfdx_package_artifact}\n`, {flag:'a'});
          console.log(`sfpowerscripts_artifact_directory=${sfdx_package_artifact}`);
        }
      }
    } catch (err) {
      console.log(err);
      // Fail the task when an error occurs
      process.exit(1);
    }
  }
}
