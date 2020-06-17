import CreateUnlockedPackageImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/CreateUnlockedPackageImpl';
import PackageDiffImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/PackageDiffImpl';
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
    diffcheck: flags.boolean({description: messages.getMessage('diffCheckFlagDescription')}),
    gittag: flags.boolean({description: messages.getMessage('gitTagFlagDescription')}),
    repourl: flags.string({char: 'r', description: messages.getMessage('repoUrlFlagDescription')}),
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

        let result:{packageVersionId:string,versionNumber:string, testCoverage:number,hasPassedCoverageCheck:boolean} = await createUnlockedPackageImpl.exec(
          command
        );

        if (this.flags.gittag) {
          exec(`git config --global user.email "sfpowerscripts@dxscale"`);
          exec(`git config --global user.name "sfpowerscripts"`);

          let tagname = `${sfdx_package}_v${result.versionNumber}`;
          console.log(`Creating tag ${tagname}`);
          exec(`git tag -a -m "${sfdx_package} Unlocked Package ${result.versionNumber}" ${tagname} HEAD`, {silent:false});
        }

        if (build_artifact_enabled) {

          let repository_url: string;
          if (isNullOrUndefined(this.flags.repourl)) {
            repository_url = exec('git config --get remote.origin.url', {silent:true});
            // Remove new line '\n' from end of url
            repository_url = repository_url.slice(0,repository_url.length - 1);
          } else repository_url = this.flags.repourl;

          let commit_id = exec('git log --pretty=format:\'%H\' -n 1', {silent:true});


          let metadata = {
            package_name: sfdx_package,
            package_version_number: result.versionNumber,
            package_version_id: result.packageVersionId,
            sourceVersion: commit_id,
            repository_url:repository_url,
            test_coverage:result.testCoverage,
            has_passed_coverage_check:result.hasPassedCoverageCheck,
            package_type:"unlocked"
          };

          let artifactFileName:string = `/${sfdx_package}_artifact_metadata`;

          fs.writeFileSync(process.env.PWD + artifactFileName, JSON.stringify(metadata));

          if (!isNullOrUndefined(this.flags.refname)) {
            console.log("\nOutput variables:");
            fs.writeFileSync('.env', `${this.flags.refname}_sfpowerscripts_package_version_id=${result.packageVersionId}\n`, {flag:'a'});
            console.log(`${this.flags.refname}_sfpowerscripts_package_version_id`);
            fs.writeFileSync('.env', `${this.flags.refname}_sfpowerscripts_artifact_metadata_directory=${process.env.PWD}/${sfdx_package}_artifact_metadata\n`, {flag:'a'});
            console.log(`${this.flags.refname}_sfpowerscripts_artifact_metadata_directory`);
            fs.writeFileSync('.env', `${this.flags.refname}_sfpowerscripts_package_version_number=${result.versionNumber}\n`, {flag:'a'});
            console.log(`${this.flags.refname}_sfpowerscripts_package_version_number`);
          } else {
            console.log("\nOutput variables:");
            fs.writeFileSync('.env', `sfpowerscripts_package_version_id=${result.packageVersionId}\n`, {flag:'a'});
            console.log("sfpowerscripts_package_version_id");
            fs.writeFileSync('.env', `sfpowerscripts_artifact_metadata_directory=${process.env.PWD}/${sfdx_package}_artifact_metadata\n`, {flag:'a'});
            console.log("sfpowerscripts_artifact_metadata_directory");
            fs.writeFileSync('.env', `sfpowerscripts_package_version_number=${result.versionNumber}\n`, {flag:'a'});
            console.log(`sfpowerscripts_package_version_number`);
          }
        }
      }
    } catch(err) {
      console.log(err);
      process.exit(1);
    }
  }
}
