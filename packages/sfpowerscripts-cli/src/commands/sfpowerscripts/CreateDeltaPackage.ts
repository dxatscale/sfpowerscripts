import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import CreateDeltaPackageImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/CreateDeltaPackageImpl';
import {isNullOrUndefined} from "util";
import {exec} from "shelljs";
const path = require("path");
const fs = require("fs");

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'create_delta_package');

export default class CreateDeltaPackage extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `sfdx CreateDeltaPackage -n packagename -r 61635fb -t 3cf01b9 -v 1.2.10 -b 
  `
  ];

  protected static requiresProject = true;
  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  protected static flagsConfig = {
    package: flags.string({required: true , char: 'n', description: messages.getMessage('packageNameFlagDescription')}),
    revisionfrom: flags.string({required: true, char: 'r', description: messages.getMessage('revisionFromFlagDescription')}),
    revisionto : flags.string({char: 't', description: messages.getMessage('revisionToFlagDescription')}),
    versionname: flags.string({required: true, char: 'v', description: messages.getMessage('versionNameFlagDescription')}),
    buildartifactenabled : flags.boolean({char: 'b', description: messages.getMessage('buildArtifactEnabledFlagDescription')}),
    projectdir: flags.string({char: 'd', description: messages.getMessage('projectDirectoryFlagDescription')}),
    generatedestructivemanifest: flags.boolean({char: 'x', description: messages.getMessage('generateDestructiveManifestFlagDescription')}),
    bypassdirectories: flags.string({description: messages.getMessage('bypassDirectoriesFlagDescription')}),
    onlydifffor: flags.string({description: messages.getMessage('onlyDiffForFlagDescription')}),
    refname: flags.string({required: true , description: messages.getMessage('refNameFlagDescription')})
  };


  public async run(){
    try {
      const sfdx_package = this.flags.package;
      const projectDirectory = this.flags.projectdir;
      const versionName: string = this.flags.versionname;
    
      let revisionFrom: string = this.flags.revisionfrom;
      let revision_to: string = this.flags.revisionto;
      let options:any = {};
    
      options['bypass_directories']= this.flags.bypassdirectories;
      options['only_diff_for']= this.flags.onlydifffor;
      
      if (isNullOrUndefined(revision_to)) {
        revision_to = exec('git log --pretty=format:\'%H\' -n 1', {silent:true});
      }
    
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
  
      await createDeltaPackageImp.exec(command);
  
      let artifactFilePath = path.join(
        process.env.PWD,
        `${sfdx_package}_src_delta`
      );
  
      fs.writeFileSync('.env', `${this.flags.refname}_sfpowerscripts_delta_package_path=${artifactFilePath}\n`, {flag:'a'});
  
      if (build_artifact_enabled) {  
        // Write artifact metadata 
  
        let repository_url = 
          exec('git config --get remote.origin.url', {silent:true});
          // Remove new line '\n' from end of url
          repository_url = repository_url.slice(0,repository_url.length - 1);
  
        let commit_id = exec('git log --pretty=format:\'%H\' -n 1', {silent:true});
  
        let metadata = {
          package_name: sfdx_package,
          sourceVersion: commit_id,
          repository_url: repository_url,
          package_type: "delta",
          package_version_name: versionName
        };
        
        let artifactFileName: string = `/${sfdx_package}_artifact_metadata`;
  
        fs.writeFileSync(
          process.env.PWD + artifactFileName,
          JSON.stringify(metadata)
        );
        
        fs.writeFileSync('.env', `${this.flags.refname}_sfpowerscripts_artifact_metadata_directory=${process.env.PWD}/${sfdx_package}_artifact_metadata\n`, {flag:'a'});
      }
    } catch (err) {
      console.log(err);
      // Fail the task when an error occurs
      process.exit(1); 
    }  
  }
}
