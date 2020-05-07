import CreateUnlockedPackageImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/CreateUnlockedPackageImpl';
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import {isNullOrUndefined} from "util";
import {exec} from "shelljs";
const fs = require("fs");
// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'create_unlocked_package');

export default class CreateUnlockedPackage extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `sfdx sfpowerscripts:CreateUnlockedPackage -n packagealias -b -x -v HubOrg --tag tagname\n` +
  `Output variable:\n` +
  `sfpowerscripts_package_version_id\n` +
  `<refname>_sfpowerscripts_package_version_id\n` +
  `sfpowerscripts_artifact_metadata_directory\n` +
  `<refname>_sfpowerscripts_artifact_metadata_directory`
  ];

  protected static requiresProject = true;
  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  protected static flagsConfig = {
    package: flags.string({required: true, char: 'n' , description: messages.getMessage('packageFlagDescription')}),
    buildartifactenabled: flags.boolean({char: 'b', description: messages.getMessage('buildArtifactEnabledFlagDescription')}),
    installationkey: flags.string({char: 'k', description: messages.getMessage('installationKeyFlagDescription'), exclusive: ['installationkeybypass']}),
    installationkeybypass: flags.boolean({char: 'x', description: messages.getMessage('installationKeyBypassFlagDescription'), exclusive: ['installationkey']}),
    devhubalias: flags.string({char: 'v', description: messages.getMessage('devhubAliasFlagDescription'), default: 'HubOrg'}),
    versionnumber: flags.string({description: messages.getMessage('versionNumberFlagDescription')}),
    configfilepath: flags.string({char: 'f', description: messages.getMessage('configFilePathFlagDescription'), default: 'config/project-scratch-def.json'}),
    projectdir: flags.string({char: 'd', description: messages.getMessage('projectDirectoryFlagDescription')}),
    enablecoverage: flags.boolean({description: messages.getMessage('enableCoverageFlagDescription')}), 
    isvalidationtobeskipped: flags.boolean({char: 's', description: messages.getMessage('isValidationToBeSkippedFlagDescription')}),
    tag: flags.string({description: messages.getMessage('tagFlagDescription')}),
    waittime: flags.string({description: messages.getMessage('waitTimeFlagDescription'), default: '120'}),
    refname: flags.string({description: messages.getMessage('refNameFlagDescription')})
  };


  public async run(){
    try {  
      let sfdx_package: string = this.flags.package;
      let version_number: string = this.flags.versionnumber;
      
      if (isNullOrUndefined(version_number)) {
        let sfdx_project_json = fs.readFileSync(
          'sfdx-project.json',
          'utf8'    
        );

        let sfdx_project = JSON.parse(sfdx_project_json);
        
        // Set version_number to package version number if available
        sfdx_project.packageDirectories.forEach( (dir) => {
          if (dir.package == sfdx_package) version_number = dir.versionNumber; 
        });
      }
      

      let tag: string = this.flags.tag;
      let config_file_path = this.flags.configfilepath;
      let installationkeybypass = this.flags.installationkeybypass;
      let isCoverageEnabled:boolean = this.flags.enablecoverage;
      let isSkipValidation:boolean = this.flags.isvalidationtobeskipped;

      let installationkey;

      if (!installationkeybypass) 
      installationkey = this.flags.installationkey;

      let project_directory = this.flags.projectdir;
      let devhub_alias = this.flags.devhubalias;
      let wait_time = this.flags.waittime;

      let build_artifact_enabled = this.flags.buildartifactenabled;

      let createUnlockedPackageImpl: CreateUnlockedPackageImpl = new CreateUnlockedPackageImpl(
          sfdx_package,
          version_number,
          tag,
          config_file_path,
          installationkeybypass,
          installationkey,
          project_directory,
          devhub_alias,
          wait_time,
          isCoverageEnabled,
          isSkipValidation
        );
        
  
        let command: string = await createUnlockedPackageImpl.buildExecCommand();
        
        console.log(`Package Creation Command: ${command}`)
  
        let package_version_id: string = await createUnlockedPackageImpl.exec(
          command
        );
        
        if (!isNullOrUndefined(this.flags.refname)) {
          fs.writeFileSync('.env', `${this.flags.refname}_sfpowerscripts_package_version_id=${package_version_id}\n`, {flag:'a'});
        } else {
          fs.writeFileSync('.env', `sfpowerscripts_package_version_id=${package_version_id}\n`, {flag:'a'});
        }

        if (build_artifact_enabled) {
  
          let repository_url: string = 
            exec('git config --get remote.origin.url', {silent:true});
            // Remove new line '\n' from end of url
            repository_url = repository_url.slice(0,repository_url.length - 1);
            
          let commit_id = exec('git log --pretty=format:\'%H\' -n 1', {silent:true});
  
          
          let metadata = {
            package_name: sfdx_package,
            package_version_number: version_number,
            package_version_id: package_version_id,
            sourceVersion: commit_id,
            repository_url:repository_url,
            package_type:"unlocked"
          };
          
          let artifactFileName:string = `/${sfdx_package}_artifact_metadata`;

          fs.writeFileSync(process.env.PWD + artifactFileName, JSON.stringify(metadata));
          if (!isNullOrUndefined(this.flags.refname)) {
            fs.writeFileSync('.env', `${this.flags.refname}_sfpowerscripts_artifact_metadata_directory=${process.env.PWD}/${sfdx_package}_artifact_metadata\n`, {flag:'a'});
          } else {
            fs.writeFileSync('.env', `sfpowerscripts_artifact_metadata_directory=${process.env.PWD}/${sfdx_package}_artifact_metadata\n`, {flag:'a'});
          }
        }
    } catch(err) {
      // AppInsights.trackExcepiton("sfpwowerscripts-createunlockedpackage-task",err);
  
      console.log(err);
      
      // Fail the task when an error occurs
      process.exit(1); 
    } 
  }
}
