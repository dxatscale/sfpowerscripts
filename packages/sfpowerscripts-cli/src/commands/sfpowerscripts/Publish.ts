import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import fs = require("fs-extra");
import path = require("path");
import ArtifactFilePathFetcher from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";
import child_process = require("child_process");

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'publish');

export default class Promote extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:Publish`
  ];

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  protected static flagsConfig = {
    artifactdir: flags.directory({
      required: true, char: 'd',
      description: messages.getMessage('artifactDirectoryFlagDescription'),
      default: 'artifacts'
    }),
    publishpromotedonly: flags.boolean({
      char: 'p',
      description: messages.getMessage('publishPromotedOnlyFlagDescription'),
      default: false
    }),
    scriptpath: flags.filepath({
      required: true,
      char: 'f',
      description: messages.getMessage('scriptPathFlagDescription')
    })
  };


  public async execute(){
    try {
      if (!fs.existsSync(this.flags.scriptpath))
        throw new Error(`Script path ${this.flags.scriptpath} does not exist`);

      let artifacts = ArtifactFilePathFetcher.findArtifacts(this.flags.artifactdir);
      // Pattern captures two named groups, the "package" name and "version" number
      let pattern = new RegExp("(?<package>^.*)(?:sfpowerscripts_artifact_)(?<version>.*)(?:\.zip)");
      for (let artifact of artifacts) {
        let packageName: string;
        let packageVersionNumber: string;

        let match: RegExpMatchArray = path.basename(artifact).match(pattern);

        if (match !== null) {
          packageName = match.groups.package; // can be an empty string
          if (packageName) {
            // Remove trailing underscore
            packageName = packageName.substring(0, packageName.length - 1);
          }
          packageVersionNumber = match.groups.version;
        } else {
          // artifact filename doesn't match pattern
          continue;
        }

        try {
          child_process.execSync(
            `bash -e ${this.flags.scriptpath} ${packageName} ${packageVersionNumber} ${artifact}`,
            {
              cwd: process.cwd(),
              stdio: ['ignore', 'inherit', 'inherit']
            }
          );
        } catch (err) {
          console.log(err.message);
          process.exitCode = 1;
        }
      }

    } catch (err) {
      console.log(err.message);

      // Fail the task when an error occurs
      process.exitCode = 1;
    }
  }
}
