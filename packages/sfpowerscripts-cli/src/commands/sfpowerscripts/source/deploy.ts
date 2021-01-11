
import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import { isNullOrUndefined } from 'util';
import DeployMDAPIDirToOrgImpl, { DeployResult, DeploymentOptions } from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/DeployMDAPIDirToOrgImpl"
import PackageMetadataPrinter from "@dxatscale/sfpowerscripts.core/lib/display/PackageMetadataPrinter"
import PackageManifest from "@dxatscale/sfpowerscripts.core/lib/package/PackageManifest"
import ConvertSourceToMDAPIImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/ConvertSourceToMDAPIImpl"
import { DeploymentCommandStatus } from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/DeploymentCommandStatus';
import DeployErrorDisplayer from "@dxatscale/sfpowerscripts.core/lib/display/DeployErrorDisplayer"
import PackageEmptyChecker from "@dxatscale/sfpowerscripts.core/lib/package/PackageEmptyChecker"
const fs = require('fs');

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'deploy_source');

export default class DeploySource extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:source:deploy -u scratchorg --sourcedir force-app -c\n`,
    `Output variable:`,
    `sfpowerkit_deploysource_id`,
    `<refname_sfpowerkit_deploysource_id`
  ];


  protected static flagsConfig = {
    targetorg: flags.string({char: 'u', description: messages.getMessage('targetOrgFlagDescription'), default: 'scratchorg'}),
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

  public async execute(){
    try {
      const target_org: string = this.flags.targetorg;
      const source_directory: string = this.flags.sourcedir;
      let project_directory: string = this.flags.projectdir;



      let deployMDAPIDirToOrgImpl: DeployMDAPIDirToOrgImpl;
      let mdapiOptions:DeploymentOptions = {
          isCheckOnlyDeployment:this.flags.checkonly,
          testLevel:this.flags.testlevel,
          specifiedTests: this.flags.specifiedtests,
          isIgnoreErrors:this.flags.ignoreerrors,
          isIgnoreWarnings: this.flags.ignorewarnings

      };

   
      let emptyCheckResults=PackageEmptyChecker.isToBreakBuildForEmptyDirectory(project_directory,source_directory,this.flags.istobreakbuildifempty);
      if(emptyCheckResults.result=="break")
      {
        console.log(emptyCheckResults.message)
        process.exitCode=1;
        return;
      }


      let convertSourceToMDAPIImpl:ConvertSourceToMDAPIImpl = new ConvertSourceToMDAPIImpl(project_directory,source_directory);
      let mdapiDir = await convertSourceToMDAPIImpl.exec();

      PackageMetadataPrinter.printMetadataToDeploy(
        await new PackageManifest(mdapiDir).getManifest()
      );

      deployMDAPIDirToOrgImpl = new DeployMDAPIDirToOrgImpl(target_org,project_directory,mdapiDir,mdapiOptions)
      let result: DeployResult = await deployMDAPIDirToOrgImpl.exec();
      if(result.status==DeploymentCommandStatus.EXCEPTION)
      {
       throw new Error(result.result);
      }
      else if(result.status==DeploymentCommandStatus.FAILED)
      {
        DeployErrorDisplayer.printMetadataFailedToDeploy(result.result.details.componentFailures)
      }
      if (!isNullOrUndefined(result.deploy_id)) {
        if (!isNullOrUndefined(this.flags.refname)) {
          fs.writeFileSync('.env', `${this.flags.refname}_sfpowerkit_deploysource_id=${result.deploy_id}\n`, {flag:'a'});
        } else {
          fs.writeFileSync('.env', `sfpowerkit_deploysource_id=${result.deploy_id}\n`, {flag:'a'});
        }
      }

     

    } catch(err) {
      console.log(err);
      process.exit(1);
    }
  }
}
