import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import GenerateChangelogImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/GenerateChangelogImpl";
const fs = require("fs-extra");
import {isNullOrUndefined} from "util"
import simplegit, { SimpleGit } from "simple-git/promise";
const url = require('url');

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'generate_release_history');

export default class GenerateReleaseHistory extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:GenerateReleaseHistory -x path/to/manifest.json`
  ];

  protected static requiresProject = true;
  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  protected static flagsConfig = {
    manifest: flags.directory({
        required: true,
        char: 'x',
        description: messages.getMessage('manifestFlagDescription')
    }),
    limit: flags.integer({
        description: messages.getMessage('limitFlagDescription')
    })
  };


  public async run(){
    try {
        const limit: number = this.flags.limit;

        let git: SimpleGit = simplegit();

        const manifest = JSON.parse(fs.readFileSync(this.flags.manifest, "utf8"));

        const releaseHistory: ReleaseHistory = {
            releases: []
        };

        const workItemFilter: string = manifest["workItemFilter"];
        const workItemURL: string = manifest["workItemURL"];
        const tagCommitIdMap = {};

        this.ux.startSpinner(`Generating release history, as per manifest ${this.flags.manifest}`);
        // Generate changelog between releases defined in manifest
        for (let releaseNum = 0 ; releaseNum < manifest["releases"].length ; releaseNum++ ) {

            // Initalise release object
            let nextRelease: release = {
                "name": manifest["releases"][releaseNum]["name"],
                "workItems": {},
                "artifacts": []
            }

            for (let artifact of manifest["releases"][releaseNum]["artifacts"]) {

                let artifactFromVersion: string;
                if (releaseNum > 0) {
                    // Get artifact version from previous release
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
                }

                let revTo: string;
                try {
                    revTo = await git.revparse([
                        "--short",
                        artifact["version"]
                    ]);

                    tagCommitIdMap[artifact["version"]] = revTo;

                } catch(revisionError) {
                    console.log(`Unable to find revision ${artifact["version"]}`);
                    throw(revisionError);
                }


                // Generate changelog for single artifact between two release versions
                let generateChangelogImpl: GenerateChangelogImpl = new GenerateChangelogImpl(
                    artifact["name"],
                    revFrom,
                    revTo,
                    workItemFilter
                );

                let result = await generateChangelogImpl.exec();

                // Add work items to the release
                // Work items and their commits are deduped
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

            // Convert each work item Set to Array
            // Enables JSON stringification of work item
            for (let key in nextRelease["workItems"]) {
                nextRelease["workItems"][key] = Array.from(nextRelease["workItems"][key]);
            }

            releaseHistory["releases"].push(nextRelease);
        }

        fs.writeFileSync(`releasechangelog.json`, JSON.stringify(releaseHistory, null, 4));

        generateMarkdown(releaseHistory, workItemURL, tagCommitIdMap, limit);

        this.ux.stopSpinner();
        console.log(`Successfully generated release history ${process.cwd()}/releasechangelog.md`);
    } catch (err) {
      console.log(err.message);
      process.exit(1);
    }
  }
}

function generateMarkdown(releaseHistory: ReleaseHistory, workItemURL: string, tagCommitIdMap, limit: number): void {
     let payload: string = "";

     let releaseNum: number;
     if (limit != null)
        releaseNum = releaseHistory["releases"].length - limit;
     else
        releaseNum = 0;

     // Start from latest Release
     for (let i = releaseHistory["releases"].length - 1 ; i >= releaseNum ; i-- ) {
         let release = releaseHistory["releases"][i];

         payload += `\n# ${release["name"]}\n`;

         payload += "## Artifacts\n";
         for (let artifact of release["artifacts"]) {
            //  Object.keys(tagCommitIdMap).find
             payload += `**${artifact["name"]}**     ${tagCommitIdMap[artifact["to"]]} (${artifact["to"]})\n\n`;
         }

         payload += "## Work Items\n";
         for (let workItem in release["workItems"]) {
             if (workItemURL != null) {
                 workItemURL = url.resolve(workItemURL, `/${workItem}`);
             }
             payload += `  - [${workItem}](${workItemURL})\n`
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

interface ReleaseHistory {
    releases: release[]
}

type release = {
    name: string,
    workItems: any
    artifacts: artifact[]
}

type artifact = {
    name: string,
    from: string,
    to: string,
    commits: commit[]
}

type commit = {
    date: string,
    commitId: string,
    elapsedDays: string,
    message: string,
    body: string
}
