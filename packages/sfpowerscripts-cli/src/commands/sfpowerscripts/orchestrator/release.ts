import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/utils/SFPStatsSender";
import ReleaseImpl, { ReleaseResult } from "../../../impl/release/ReleaseImpl";
import ReleaseDefinition from "../../../impl/release/ReleaseDefinition";
import ReleaseError from "../../../errors/ReleaseError";
import path = require("path");
import * as fs from "fs-extra";
var marked = require('marked');
var TerminalRenderer = require('marked-terminal');
import {delay} from "@dxatscale/sfpowerscripts.core/lib/utils/Delay";

marked.setOptions({
  // Define custom renderer
  renderer: new TerminalRenderer()
});

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'release');

export default class Release extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `sfdx sfpowerscripts:orchestrator:release -p path/to/releasedefinition.yml -u myorg --npm --scope myscope --generatechangelog`
  ];

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;
  protected static requiresProject = false;

  protected static flagsConfig = {
    releasedefinition: flags.filepath({
      char: "p",
      description: messages.getMessage('releaseDefinitionFlagDescription')
    }),
    targetorg: flags.string({
      char: "u",
      description: messages.getMessage("targetOrgFlagDescription"),
      default: "scratchorg",
      required: true
    }),
    scriptpath: flags.filepath({
      char: 'f',
      description: messages.getMessage('scriptPathFlagDescription')
    }),
    npm: flags.boolean({
      description: messages.getMessage('npmFlagDescription'),
      exclusive: ['scriptpath']
    }),
    scope: flags.string({
      description: messages.getMessage('scopeFlagDescription'),
      dependsOn: ['npm'],
      parse: (scope) => scope.replace(/@/g,"").toLowerCase()
    }),
    npmrcpath: flags.filepath({
      description: messages.getMessage('npmrcPathFlagDescription'),
      dependsOn: ['npm'],
      required: false
    }),
    logsgroupsymbol: flags.array({
      char: "g",
      description: messages.getMessage("logsGroupSymbolFlagDescription")
    }),
    tag: flags.string({
      char: 't',
      description: messages.getMessage('tagFlagDescription')
    }),
    dryrun: flags.boolean({
      description: messages.getMessage("dryRunFlagDescription"),
      default: false,
      hidden: true
    }),
    waittime: flags.number({
      description: messages.getMessage("waitTimeFlagDescription"),
      default: 120
    }),
    keys: flags.string({
      required: false,
      description: messages.getMessage("keysFlagDescription")
    }),
    generatechangelog: flags.boolean({
      default: false,
      description: messages.getMessage("generateChangelogFlagDescription")
    }),
    allowunpromotedpackages: flags.boolean({
      description: messages.getMessage("allowUnpromotedPackagesFlagDescription"),
      hidden: true
    })
  };


  public async execute(){
    try {
      const manifestPath: string = process.env.manifest;

      let manifest: Manifest = fs.readJSONSync(manifestPath, {"encoding": "UTF-8"});
      for(let response of manifest.sequence) {
        let ext = path.extname(response.filepath);
        let data = fs.readFileSync(response.filepath, "utf8");

        if (response.data) {
          Object.entries(response.data).forEach((entry) => {
            data = data.replace(`\$\{\{${entry[0]}\}\}`, entry[1]);
          });
        }

        if (response.repeat) {
          let count = 0;
          while (count <= response.repeat) {
            await delay(response.preDelay);
            if (ext === ".md") {
              console.log(marked(data));
            } else {
              console.log(data);
            }
            count++
            await delay(response.postDelay);
          }
        } else {
          await delay(response.preDelay);
          if (ext === ".md") {
            console.log(marked(data));
          } else {
            console.log(data);
          }
          await delay(response.postDelay);
        }
      }

    } catch (err) {
      console.log(err.message);
      // Fail the task when an error occurs
      process.exitCode = 1;
    }

  }

}

interface Manifest {
  sequence: {
    filepath: string,
    preDelay: number,
    postDelay: number,
    repeat: number,
    data: {[p: string]: string}
  }[]
}
