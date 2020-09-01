import { flags, SfdxCommand } from '@salesforce/command';
import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import GenerateChangelogImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/GenerateChangelogImpl";
import { exec } from "shelljs";
const fs = require("fs-extra");
import {isNullOrUndefined} from "util"

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'generate_changelog');

export default class GenerateChangelog extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [

  ];

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  protected static flagsConfig = {
    package: flags.string({char: 'n', description: messages.getMessage('packageFlagDescription')}),
    manifest: flags.directory({required: true, char: 'x', description: messages.getMessage('manifestFlagDescription')}),
    revfrom: flags.string({required: false, char: 'r', description: messages.getMessage('revisionFromFlagDescription')}),
    revto: flags.string({required: false, char: 't', description: messages.getMessage('revisionToFlagDescription')}),
    symbol: flags.string({description: messages.getMessage('symbolFlagDescription')})
  };


  public async run(){
    try {
        const manifest = JSON.parse(fs.readFileSync(this.flags.manifest, "utf8"));

        const masterChangelog = {
            workItems: {},
            packages: []
        };

        // Invoke Impl for each package
        const workItemFilter: string = manifest["workItemFilter"];


        for (let pkg of manifest["packages"]) {
            let generateChangelogImpl: GenerateChangelogImpl = new GenerateChangelogImpl(
                pkg["name"],
                pkg["from"],
                pkg["to"],
                workItemFilter
            );
            let result = await generateChangelogImpl.exec();

            // Merge with master changelog
            for (let item in result["workItems"]) {
                if (masterChangelog["workItems"][item] == null) {
                    masterChangelog["workItems"][item] = result["workItems"][item];
                } else {
                    for (let commit of result["workItems"][item]) {
                        masterChangelog["workItems"][item].add(commit);
                    }
                }
            }

            masterChangelog["packages"].push(result["package"]);
        }

        // Convert back to array for JSON stringify
        for (let key in masterChangelog["workItems"]) {
            masterChangelog["workItems"][key] = Array.from(masterChangelog["workItems"][key]);
        }


        fs.writeFileSync(`masterchangelog.json`, JSON.stringify(masterChangelog, null, 4));


        // Generate Markdown
        let payload: string = "# Release X.Y.Z Changelog\n";

        payload += "## Packages\n";
        for (let pkg of masterChangelog["packages"]) {
            payload += `**${pkg["name"]}**      from: ${pkg["from"]}        to: ${pkg["to"]}\n\n`;
        }

        payload += "## Work Items\n";
        for (let key in masterChangelog["workItems"]) {
            payload += `  - ${key}\n`
        }

        payload += "## Commits\n";
        for (let pkg of masterChangelog["packages"]) {
            payload += `### ${pkg["name"]}\n`;
            for (let commit of pkg["commits"]) {
                payload += `  - ${commit.date}      ${commit.commitId}      ${commit.message}\n`;
            }
        }

        fs.writeFileSync(`masterchangelog.md`, payload);

    } catch (err) {
      console.log(err);
      // Fail the task when an error occurs
      process.exit(1);
    }
  }
}
