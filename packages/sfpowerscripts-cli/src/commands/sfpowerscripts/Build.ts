import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import ArtifactGenerator from "@dxatscale/sfpowerscripts.core/lib/generators/ArtifactGenerator";
import CreateUnlockedPackageImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/CreateUnlockedPackageImpl';
import PackageDiffImpl from '@dxatscale/sfpowerscripts.core/lib/package/PackageDiffImpl';
import BuildImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/BuildImpl';

import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import {isNullOrUndefined} from "util";
import {exec} from "shelljs";
const fs = require("fs-extra");


// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages(
  "@dxatscale/sfpowerscripts",
  "create_unlocked_package"
);

export default class Build extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:Build -n <packagealias> -b -x -v <devhubalias> --refname <name>`,
    `$ sfdx sfpowerscripts:Build -n <packagealias> -b -x -v <devhubalias> --diffcheck --gittag\n`,
    `Output variable:`,
    `sfpowerscripts_package_version_id`,
    `<refname>_sfpowerscripts_package_version_id`,
    `sfpowerscripts_artifact_metadata_directory`,
    `<refname>_sfpowerscripts_artifact_metadata_directory`,
    `sfpowerscripts_artifact_directory`,
    `<refname>_sfpowerscripts_artifact_directory`,
    `sfpowerscripts_package_version_number`,
    `<refname>_sfpowerscripts_package_version_number`
  ];

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  protected static flagsConfig = {
  
    devhubalias: flags.string({char: 'v', description: messages.getMessage('devhubAliasFlagDescription'), default: 'HubOrg'}),
    diffcheck: flags.boolean({description: messages.getMessage('diffCheckFlagDescription')}),
    gittag: flags.boolean({description: messages.getMessage('gitTagFlagDescription')}),
    repourl: flags.string({char: 'r', description: messages.getMessage('repoUrlFlagDescription')}),
    configfilepath: flags.filepath({char: 'f', description: messages.getMessage('configFilePathFlagDescription'), default: 'config/project-scratch-def.json'}),
    artifactdir: flags.directory({description: messages.getMessage('artifactDirectoryFlagDescription'), default: 'artifacts'}),
    isvalidationtobeskipped: flags.boolean({char: 's', description: messages.getMessage('isValidationToBeSkippedFlagDescription')}),
    waittime: flags.string({description: messages.getMessage('waitTimeFlagDescription'), default: '120'}),
    buildnumber: flags.string({description: messages.getMessage('waitTimeFlagDescription'), default: '1'}),
    refname: flags.string({description: messages.getMessage('refNameFlagDescription')})
  };


  public async execute(){
    try {

      const artifactDirectory: string = this.flags.artifactdir;
      const refname: string = this.flags.refname;
      const repourl:string=this.flags.repourl;
      const config_file_path = this.flags.configfilepath;
      const isSkipValidation: boolean = this.flags.isvalidationtobeskipped;
      const devhub_alias = this.flags.devhubalias;
      const wait_time = this.flags.waittime;
      const diffcheck:boolean = this.flags.diffcheck;
      const buildNumber:string = this.flags.buildnumber;

      

      let buildImpl = new BuildImpl(config_file_path,null,devhub_alias,repourl,wait_time,isSkipValidation,diffcheck,buildNumber);
      let packageCreationResults = await buildImpl.exec();


 
    } catch (err) {
      console.log(err);
      process.exit(1);
    }
  }
}
