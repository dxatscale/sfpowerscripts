import ExportSourceFromAnOrgImpl from '@dxatscale/sfpowerscripts.core/sfdxwrappers/ExportSourceFromAnOrgImpl';
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
const fs = require("fs");

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'export_source');

export default class ExportSource extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  `sfdx ExportSource -u scratchorg -d metadata -x -e 
  `
  ];


  protected static flagsConfig = {
    targetorg: flags.string({char: 'u', description: messages.getMessage('targetOrgFlagDescription'), default: 'scratchorg'}),
    sourcedir: flags.string({char: 'd', description: messages.getMessage('sourceDirectoryFlagDescription'), default: 'metadata'}),
    quickfilter: flags.string({description: messages.getMessage('quickFilterFlagDescription')}),
    ismanagedpackagestobeexcluded: flags.boolean({char: 'x', description: messages.getMessage('isManagedPackagesToBeExcludedFlagDescription')}),
    isunzipenabled: flags.boolean({char: 'e', description: messages.getMessage('isUnzipEnabledFlagDescription')}),
    refname: flags.string({required: true, description: messages.getMessage('refNameFlagDescription')})
  };


  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  public async run(){
    try {
      console.log("SFPowerScript.. Export Source from an  Org");
  
      // AppInsights.setupAppInsights(tl.getBoolInput("isTelemetryEnabled", true));
  
      const target_org: string = this.flags.targetorg;
      const source_directory: string = this.flags.sourcedir;
      const filter: string = this.flags.quickfilter;
      const isManagedPackagesToBeExcluded = this.flags.ismanagedpackagestobeexcluded;
      const isUnzipEnabled = this.flags.isunzipenabled;
  
      let exportSourceFromAnOrgImpl: ExportSourceFromAnOrgImpl;
  
      exportSourceFromAnOrgImpl = new ExportSourceFromAnOrgImpl(
        target_org,
        source_directory,
        filter,
        isManagedPackagesToBeExcluded,
        isUnzipEnabled
      );
  
      let zipPath = await exportSourceFromAnOrgImpl.exec();
  
      if(!isUnzipEnabled)
      fs.writeFileSync('.env', `${this.flags.refname}_sfpowerscripts_exportedsource_zip_path=${zipPath}\n`, {flag:'a'});
        
      // AppInsights.trackTask("sfpowerscript-exportsourcefromorg-task");
      // AppInsights.trackTaskEvent(
      //   "sfpowerscript-exportsourcefromorg-task",
      //   "source_exported"
      // );
    } catch (err) {
      // AppInsights.trackExcepiton("sfpowerscript-exportsourcefromorg-task", err);
      console.log(err);
  
      process.exit(1);
    }
  }
}
