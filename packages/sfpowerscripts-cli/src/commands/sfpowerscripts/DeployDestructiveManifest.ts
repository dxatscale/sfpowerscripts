import DeployDestructiveManifestToOrgImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/DeployDestructiveManifestToOrgImpl';
import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';
import { Messages, SfdxError } from '@salesforce/core';
const fs = require("fs");
const path = require("path");
const dotenv = require('dotenv').config();

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'deploy_destructive_manifest');

export default class DeployDestructiveManifest extends SfpowerscriptsCommand {

    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfdx sfpowerscripts:DeployDestructiveManifest -u scratchorg -m Text -t "<?xml version=\"1.0\" encoding=\"UTF-8\"?>`,
        `<Package xmlns=\"http://soap.sforce.com/2006/04/metadata\"><types><members>myobject__c</members><name>CustomObject</name></types></Package>"`
    ];

    protected static flagsConfig = {
        targetorg: flags.string({
          char: 'u',
          description: messages.getMessage('targetOrgFlagDescription'),
          default: 'scratchorg'}),
        method: flags.string({
          char: 'm',
          description: messages.getMessage('methodFlagDescription'),
          options: ['Text', 'FilePath'],
          default: 'Text'
        }),
        destructivemanifesttext: flags.string({
          char: 't',
          description: messages.getMessage('destructiveManifestTextFlagDescription')
        }),
        destructivemanifestfilepath: flags.string({
          char: 'f',
          description: messages.getMessage('destructiveManifestFilePathFlagDescription'),
          exclusive: ['destructivemanifesttext']
        }),
        skiponmissingmanifest: flags.boolean({
          description: messages.getMessage('skipOnMissingManifestFlagDescription')
        })
    };

    protected static requiresProject = true;
    protected static requiresUsername = false;
    protected static requiresDevhubUsername = false;

    public async run() {
        try {
            this.loadSfpowerscriptsVariables(this.flags);

            console.log("SFPowerScript.. Deploy Destructive Manifest to Org");

            const targetOrg: string = this.flags.targetorg;
            const method: string = this.flags.method;
            const skiponmissingmanifest: boolean = this.flags.skiponmissingmanifest;
            let destructiveManifestPath = null;

            if(method == "Text")
            {

              let destructiveManifest=  this.flags.destructivemanifesttext;
              destructiveManifestPath = path.join(__dirname,"destructiveChanges.xml")
              fs.writeFileSync(destructiveManifestPath,destructiveManifest);
              console.log(destructiveManifestPath);
            }
            else
            {
              destructiveManifestPath =  this.flags.destructivemanifestfilepath;
              console.log(`Destructive Manifest File Path: ${destructiveManifestPath}`);
              if(!fs.existsSync(destructiveManifestPath))
              {
                if (skiponmissingmanifest) {
                  console.log("Unable to find the specified manifest file");
                  return
                } else {
                  throw new SfdxError("Unable to find the specified manifest file...Skipping");
                }
              }
            }

            console.log("Displaying Destructive Manifest");

            let destructiveManifest:Buffer = fs.readFileSync(destructiveManifestPath);
            console.log(destructiveManifest.toString());

            let  deploySourceToOrgImpl:DeployDestructiveManifestToOrgImpl = new DeployDestructiveManifestToOrgImpl(targetOrg,destructiveManifestPath);
            await deploySourceToOrgImpl.exec();


            console.log("Destuctive Changes succesfully deployed");

          } catch (err) {
            console.log(err);
            process.exit(1);
          }
    }
}
