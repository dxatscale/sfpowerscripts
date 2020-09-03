import { flags, SfdxCommand } from '@salesforce/command';
import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import GenerateChangelogImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/GenerateChangelogImpl";
import { exec } from "shelljs";
const fs = require("fs-extra");
import {isNullOrUndefined} from "util"
import simplegit, { SimpleGit } from "simple-git/promise";

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'generate_release_history');

export default class GenerateReleaseHistory extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [

  ];

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  protected static flagsConfig = {
    manifest: flags.directory({required: true, char: 'x', description: messages.getMessage('manifestFlagDescription')}),
  };


  public async run(){
    try {
        let git: SimpleGit = simplegit();

        const manifest = JSON.parse(fs.readFileSync(this.flags.manifest, "utf8"));

        const masterChangelog = {
            "releases": []
        };

        // Invoke Impl for each release
        const workItemFilter: string = manifest["workItemFilter"];
        const tagCommitIdMap = {};

        for (let releaseNum = 0 ; releaseNum < manifest["releases"].length ; releaseNum++ ) {

            let nextRelease = {
                "name": manifest["releases"][releaseNum]["name"],
                "workItems": {},
                "artifacts": []
            }

            for (let artifact of manifest["releases"][releaseNum]["artifacts"]) {


                let artifactFromVersion: string;

                if (releaseNum > 0) {
                    for (let prevReleaseArtifact of manifest["releases"][releaseNum-1]["artifacts"]) {
                        if (prevReleaseArtifact["name"] === artifact["name"]) {
                            artifactFromVersion = prevReleaseArtifact["version"];
                            break;
                        }
                    }
                }
                let revFrom: string;
                if (artifactFromVersion != null) {
                    revFrom = await git.revparse([
                        "--short",
                        artifactFromVersion
                    ]);
                    tagCommitIdMap[revFrom] = artifactFromVersion;
                }

                let revTo: string = await git.revparse([
                    "--short",
                    artifact["version"]
                ]);
                tagCommitIdMap[revTo] = artifact["version"];

                let generateChangelogImpl: GenerateChangelogImpl = new GenerateChangelogImpl(
                    artifact["name"],
                    revFrom,
                    revTo,
                    workItemFilter
                );

                let result = await generateChangelogImpl.exec();

                for (let item in result["workItems"]) {
                    if (nextRelease["workItems"][item] == null) {
                        nextRelease["workItems"][item] = result["workItems"][item];
                    } else {
                        for (let commit of result["workItems"][item]) {
                            nextRelease["workItems"][item].add(commit);
                        }
                    }
                }

                nextRelease["artifacts"].push(result["package"]);



            }

            // Convert back to array for JSON stringify
            for (let key in nextRelease["workItems"]) {
                nextRelease["workItems"][key] = Array.from(nextRelease["workItems"][key]);
            }

            masterChangelog["releases"].push(nextRelease);

        }

        fs.writeFileSync(`releasechangelog.json`, JSON.stringify(masterChangelog, null, 4));

        generateMarkdown(masterChangelog, manifest, tagCommitIdMap);

    } catch (err) {
      console.log(err);
      // Fail the task when an error occurs
      process.exit(1);
    }
  }
}

function generateMarkdown(masterChangelog, manifest, tagCommitIdMap): void {
     // Generate Markdown
     let payload: string = "";
     for (let i = masterChangelog["releases"].length - 1 ; i >= 0 ; i-- ) {
         let release = masterChangelog["releases"][i];
         payload += `\n# ${release["name"]}\n`;

         payload += "## Artifacts\n";
         for (let artifact of release["artifacts"]) {
             payload += `**${artifact["name"]}**     ${tagCommitIdMap[artifact["to"]]} (${artifact["to"]})\n\n`;
         }

         payload += "## Work Items\n";
         for (let key in release["workItems"]) {
             // TODO: Fix URL creation
             let workItemURL: string;
             if (manifest["workItemURL"] != null) {
                 workItemURL = manifest["workItemURL"] + key
             }
             payload += `  - [${key}](${workItemURL})\n`
         }

         payload += "\n## Commits\n";
         for (let artifact of release["artifacts"]) {
             payload += `\n### ${artifact["name"]}\n`;
             if (artifact["commits"].length > 0) {
                 for (let commit of artifact["commits"]) {
                     payload += `  - ${commit.date}      ${commit.commitId}      ${commit.message}\n`;
                 }
             } else if (artifact["from"] === artifact["to"]) {
                 payload += `  - Artifact version has not changed\n`
             } else {
                 payload += ` - No changes to ${artifact["name"]} package directory detected. Artifact version may have been updated due to:\n`;
                 payload += `    - Modified scratch org definition file\n`;
                 payload += `    - Incremented package version in sfdx-project.json\n`;
                 payload += `    - Build all packages\n`
             }
         }
     }
     fs.writeFileSync(`releasechangelog.md`, payload);
}
