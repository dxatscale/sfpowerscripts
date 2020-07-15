import CreateUnlockedPackageImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/CreateUnlockedPackageImpl';
import PackageDiffImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/PackageDiffImpl';
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import {isNullOrUndefined} from "util";
import {exec} from "shelljs";
const fs = require("fs-extra");
const path = require("path");

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
    configfilepath: flags.filepath({char: 'f', description: messages.getMessage('configFilePathFlagDescription'), default: 'config/project-scratch-def.json'}),
    projectdir: flags.directory({char: 'd', description: messages.getMessage('projectDirectoryFlagDescription')}),
    artifactdir: flags.directory({description: messages.getMessage('artifactDirectoryFlagDescription')}),
    enablecoverage: flags.boolean({description: messages.getMessage('enableCoverageFlagDescription')}),
    isvalidationtobeskipped: flags.boolean({char: 's', description: messages.getMessage('isValidationToBeSkippedFlagDescription')}),
    tag: flags.string({description: messages.getMessage('tagFlagDescription')}),
    waittime: flags.string({description: messages.getMessage('waitTimeFlagDescription'), default: '120'}),
    refname: flags.string({description: messages.getMessage('refNameFlagDescription')})
  };


  public async run(){
    try {
      const sfdx_package: string = this.flags.package;
      const version_number: string = this.flags.versionnumber;
      const project_directory: string = this.flags.projectdir;
      const artifact_directory: string = this.flags.artifactdir;
      const refname: string = this.flags.refname;

      let tag: string = this.flags.tag;
      let config_file_path = this.flags.configfilepath;
      let installationkeybypass = this.flags.installationkeybypass;
      let isCoverageEnabled:boolean = this.flags.enablecoverage;
      let isSkipValidation:boolean = this.flags.isvalidationtobeskipped;
      let installationkey = this.flags.installationkey;
      let devhub_alias = this.flags.devhubalias;
      let wait_time = this.flags.waittime;
      let build_artifact_enabled = this.flags.buildartifactenabled;

      let runBuild: boolean;
      if (this.flags.diffcheck) {
        let packageDiffImpl = new PackageDiffImpl(sfdx_package, project_directory, config_file_path);

        runBuild = await packageDiffImpl.exec();

        if ( runBuild )
        console.log(`Detected changes to ${sfdx_package} package...proceeding\n`);
        else
        console.log(`No changes detected for ${sfdx_package} package...skipping\n`);

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

        console.log(`Package Creation Command: ${command}`);

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

          fs.writeFileSync(artifactFilePath, JSON.stringify(metadata));

          console.log("\nOutput variables:");
          if (!isNullOrUndefined(refname)) {
            fs.writeFileSync('.env', `${refname}_sfpowerscripts_package_version_id=${result.packageVersionId}\n`, {flag:'a'});
            console.log(`${refname}_sfpowerscripts_package_version_id=${result.packageVersionId}`);
            fs.writeFileSync('.env', `${refname}_sfpowerscripts_artifact_metadata_directory=${artifactFilePath}\n`, {flag:'a'});
            console.log(`${refname}_sfpowerscripts_artifact_metadata_directory=${artifactFilePath}`);
            fs.writeFileSync('.env', `${refname}_sfpowerscripts_package_version_number=${result.versionNumber}\n`, {flag:'a'});
            console.log(`${refname}_sfpowerscripts_package_version_number=${result.versionNumber}`);
          } else {
            fs.writeFileSync('.env', `sfpowerscripts_package_version_id=${result.packageVersionId}\n`, {flag:'a'});
            console.log(`sfpowerscripts_package_version_id=${result.packageVersionId}`);
            fs.writeFileSync('.env', `sfpowerscripts_artifact_metadata_directory=${artifactFilePath}\n`, {flag:'a'});
            console.log(`sfpowerscripts_artifact_metadata_directory=${artifactFilePath}`);
            fs.writeFileSync('.env', `sfpowerscripts_package_version_number=${result.versionNumber}\n`, {flag:'a'});
            console.log(`sfpowerscripts_package_version_number=${result.versionNumber}`);
          }
        }
      }
    } catch(err) {
      console.log(err);
      process.exit(1);
    }
  }
}
