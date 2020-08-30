import DeploySourceToOrgImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/DeploySourceToOrgImpl';
import DeploySourceResult from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/DeploySourceResult'
import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';
import { Messages, SfdxError } from '@salesforce/core';
import { isNullOrUndefined } from 'util';
const fs = require('fs');

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'deploy_source');

export default class DeploySource extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:DeploySource -u scratchorg --sourcedir force-app -c\n`,
    `Output variable:`,
    `sfpowerkit_deploysource_id`,
    `<refname_sfpowerkit_deploysource_id`
  ];


  protected static flagsConfig = {
    targetorg: flags.string({char: 'u', description: messages.getMessage('targetOrgFlagDescription'), default: 'scratchorg'}),
    projectdir: flags.string({char: 'd', description: messages.getMessage('projectDirectoryFlagDescription')}),
    sourcedir: flags.string({description: messages.getMessage('sourceDirectoryFlagDescription'), default: 'force-app'}),
    waittime: flags.string({description: messages.getMessage('waitTimeFlagDescription'), default: '20'}),
    checkonly: flags.boolean({char: 'c', description: messages.getMessage('checkOnlyFlagDescription')}),
    validationignore: flags.string({char: 'f', description: messages.getMessage('validationIgnoreFlagDescription'), default: '.forceignore'}),
    testlevel: flags.string({char: 'l', description: messages.getMessage('testLevelFlagDescription'), options: ['NoTestRun', 'RunSpecifiedTests', 'RunApexTestSuite', 'RunLocalTests', 'RunAllTestsInOrg'], default: 'NoTestRun'}),
    specifiedtests: flags.string({description: messages.getMessage('specifiedTestsFlagDescription')}),
    apextestsuite: flags.string({description: messages.getMessage('apexTestSuiteFlagDescription')}),
    ignorewarnings: flags.boolean({description: messages.getMessage('ignoreWarningsFlagDescription')}),
    ignoreerrors: flags.boolean({description: messages.getMessage('ignoreErrorsFlagDescription')}),
    istobreakbuildifempty: flags.boolean({char: 'b' , description: messages.getMessage('isToBreakBuildIfEmptyFlagDescription'), default: false}),
    refname: flags.string({description: messages.getMessage('refNameFlagDescription')})
  };

  protected static requiresProject = true;
  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  public async sfpowerscripts_run(){
    try {

      console.log("SFPowerScript.. Deploy Source to Org");

      const target_org: string = this.flags.targetorg;
      const source_directory: string = this.flags.sourcedir;
      let project_directory: string = this.flags.projectdir;



      let deploySourceToOrgImpl: DeploySourceToOrgImpl;
      let mdapi_options = {};

      mdapi_options["wait_time"] = this.flags.waititme;
      mdapi_options["checkonly"] = this.flags.checkonly;



      if(mdapi_options["checkonly"])
        mdapi_options["validation_ignore"]= this.flags.validationignore;

      mdapi_options["testlevel"] = this.flags.testlevel;

      if (mdapi_options["testlevel"] == "RunSpecifiedTests")
        mdapi_options["specified_tests"] = this.flags.specifiedtests;
      if (mdapi_options["testlevel"] == "RunApexTestSuite")
        mdapi_options["apextestsuite"] = this.flags.apextestsuite;

      mdapi_options["ignore_warnings"]=this.flags.ignorewarnings;
      mdapi_options["ignore_errors"]=this.flags.ignoreerrors;


      let isToBreakBuildIfEmpty= this.flags.istobreakbuildifempty;



      deploySourceToOrgImpl = new DeploySourceToOrgImpl(
        target_org,
        project_directory,
        source_directory,
        mdapi_options,
        isToBreakBuildIfEmpty
      );

      let result: DeploySourceResult= await deploySourceToOrgImpl.exec();

      if (!isNullOrUndefined(result.deploy_id)) {
        if (!isNullOrUndefined(this.flags.refname)) {
          fs.writeFileSync('.env', `${this.flags.refname}_sfpowerkit_deploysource_id=${result.deploy_id}\n`, {flag:'a'});
        } else {
          fs.writeFileSync('.env', `sfpowerkit_deploysource_id=${result.deploy_id}\n`, {flag:'a'});
        }
      }

      if (!result.result) {
        console.error(result.message);
        throw new SfdxError(`Validation/Deployment with Job ID ${result.deploy_id} failed`);
      } else {
        console.log(result.message);
      }

    } catch(err) {
      console.log(err);
      process.exit(1);
    }
  }
}
