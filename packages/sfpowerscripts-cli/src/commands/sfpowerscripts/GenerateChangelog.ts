import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import { ReleaseChangelog, Release, Artifact } from "@dxatscale/sfpowerscripts.core/lib/changelog/interfaces/ReleaseChangelogInterfaces"
import { Changelog as PackageChangelog } from "@dxatscale/sfpowerscripts.core/lib/changelog/interfaces/GenericChangelogInterfaces"
import fs = require("fs-extra");
import path = require('path');
const glob = require("glob");


Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'generate_changelog');

export default class GenerateChangelog extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:GenerateChangelog`
  ];

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
    }),
    artifactdir: flags.directory({
      required: true,
      char: 'd',
      description: messages.getMessage('artifactDirectoryFlagDescription'),
      default: 'artifacts'
    }),
    releasename: flags.string({
      required: true,
      char: 'n',
      description: messages.getMessage('releaseNameFlagDescription')
    }),
    workitemfilter: flags.string({
      required: true,
      char: 'w',
      description: messages.getMessage('workItemFilterFlagDescription')
    }),
    workitemurl: flags.string({
      required: false,
      char: "r",
      description: messages.getMessage('workItemUrlFlagDescription')
    })
  };


  public async run(){
    const tempDirectories = [];
    try {
      let packageMetadataFilepaths: string[] = glob.sync(
        `**/artifact_metadata.json`,
        {
          cwd: path.resolve(process.cwd(), this.flags.artifactdir),
          absolute: true
        }
      );

      let packageChangelogMap: {[P:string]: string} = {};
      let latestReleaseDefinition: Release = {
        name: "",
        workItems: {},
        artifacts: []
      };
      // Read artifacts for latest release definition
      for (let packageMetadataFilepath of packageMetadataFilepaths ) {
        let packageMetadata: PackageMetadata = JSON.parse(fs.readFileSync(packageMetadataFilepath, 'utf8'));
        latestReleaseDefinition["name"] = this.flags.releasename;
        latestReleaseDefinition["artifacts"].push({
          name: packageMetadata["package_name"],
          from: undefined,
          to: packageMetadata["sourceVersion"],
          version: packageMetadata["package_version_number"],
          commits: undefined
        });

        packageChangelogMap[packageMetadata["package_name"]] = path.join(
          path.dirname(packageMetadataFilepath),
          `changelog.json`
        );
      }

      // Check if any packages are missing changelog
      Object.values(packageChangelogMap).forEach( (changelogPath) => {
        if (!fs.existsSync(changelogPath)) {
          throw Error("Artifact is missing changelog. Check build task version compatability");
        }
      });

      // Get artifact versions from previous release definition
      let prevReleaseDefinition: Release;
      let releaseChangelog: ReleaseChangelog;
      if (fs.existsSync(`releasechangelog.json`)) {
        releaseChangelog = JSON.parse(fs.readFileSync(`releasechangelog.json`, 'utf8'));
        if (releaseChangelog["releases"].length > 0) {
          prevReleaseDefinition = releaseChangelog["releases"][releaseChangelog["releases"].length - 1];
        }
      }

      if (prevReleaseDefinition) {
        for (let artifact of latestReleaseDefinition["artifacts"]) {
          for (let prevReleaseArtifact of prevReleaseDefinition["artifacts"]) {
            if (artifact["name"] === prevReleaseArtifact["name"]) {
              // Verify that this modifies latestReleaseDefinition
              artifact["from"] = prevReleaseArtifact["to"];
              break;
            }
          }
        }
      }

      // Get commits for the latest release
      for (let artifact of latestReleaseDefinition["artifacts"]) {
        let packageChangelog: PackageChangelog = JSON.parse(fs.readFileSync(packageChangelogMap[artifact["name"]], 'utf8'));
        let toIdx = packageChangelog["commits"].findIndex( (commit) => {
          // TODO startswith
          commit["commitId"] === artifact["to"];
        });

        let fromIdx;
        if (artifact["from"]) {
          fromIdx = packageChangelog["commits"].findIndex( (commit) => {
            commit["commitId"] === artifact["from"];
          });
        }

        // Verify that latestReleaseDefinition changes
        artifact["commits"] = packageChangelog["commits"].slice(toIdx, fromIdx ? fromIdx+1 : fromIdx);

        // Figure out work items for latest release
        let workItemFilter: RegExp = RegExp(this.flags.workitemfilter, 'gi');
        for (let commit of artifact["commits"]) {
          let workItems: RegExpMatchArray = commit["body"].match(workItemFilter) || commit["message"].match(workItemFilter);
          if (workItems) {
              for (let item of workItems) {
                  if (latestReleaseDefinition["workItems"][item] == null) {
                      latestReleaseDefinition["workItems"][item] = new Set<string>();
                      latestReleaseDefinition["workItems"][item].add(commit["commitId"].slice(0,8));
                  } else {
                      latestReleaseDefinition["workItems"][item].add(commit["commitId"].slice(0,8));
                  }
              }
          }
        }
      }

      // Append results to release changelog
      if (releaseChangelog) {
        releaseChangelog["releases"].push(latestReleaseDefinition);
      } else {
        releaseChangelog = {
          releases: [latestReleaseDefinition]
        }
      }

        const limit: number = this.flags.limit;

        // Convert each work item Set to Array
        // Enables JSON stringification of work item
        // for (let key in nextRelease["workItems"]) {
        //     nextRelease["workItems"][key] = Array.from(nextRelease["workItems"][key]);
        // }


        // generateMarkdown(releaseHistory, workItemURL, limit, releaseTags);
        // console.log(`Successfully generated release history ${process.cwd()}/releasechangelog.md`);

    } catch (err) {
        console.log(err.message);
        process.exit(1);
    }
  }
}

function generateMarkdown(releaseHistory: ReleaseChangelog, workItemURL: string, limit: number, releaseTags: string[][]): void {
     let payload: string = "";

     let limitReleases: number;
     if (limit != null)
        limitReleases = releaseHistory["releases"].length - limit;
     else
        limitReleases = 0;

     // Start from latest Release
     for (let releaseNum = releaseHistory["releases"].length - 1 ; releaseNum >= limitReleases ; releaseNum-- ) {
         let release = releaseHistory["releases"][releaseNum];

         payload += `\n# ${release["name"]}\n`;

         payload += "## Artifacts\n";
         for (let artifactNum = 0 ; artifactNum < release["artifacts"].length ; artifactNum++) {
             payload += `**${release["artifacts"][artifactNum]["name"]}**     ${releaseTags[releaseNum][artifactNum]} (${release["artifacts"][artifactNum]["to"]})\n\n`;
         }

         payload += "## Work Items\n";
         for (let workItem in release["workItems"]) {
             let specificWorkItemURL: string;
             if (workItemURL != null) {
                 if (workItemURL.endsWith('/')) {
                    specificWorkItemURL = workItemURL.concat(workItem);
                 }
                 else {
                    specificWorkItemURL = workItemURL.concat(`/${workItem}`);
                 }
             }
             payload += `  - [${workItem}](${specificWorkItemURL})\n`
         }

         payload += "\n## Commits\n";
         for (let artifact of release["artifacts"]) {
             payload += `\n### ${artifact["name"]}\n`;
             if (artifact["commits"].length > 0) {
                 for (let commit of artifact["commits"]) {
                     let commitDate: Date = new Date(commit.date);
                     payload += `  - ${getDate(commitDate)}, ${getTime(commitDate)}      ${commit.commitId}      ${commit.message}\n`;
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


function getDate(date: Date): string {
    let day: number = date.getDate();
    let month: number = date.getMonth();
    let year: number = date.getFullYear();
    let pad = (n) => n<10 ? '0'+n : n;

    return pad(day) + "/" + pad(month+1) + "/" + year;
  }

function getTime(date: Date): string {
    let hours: number = date.getHours();
    let minutes: number = date.getMinutes();
    let seconds: number = date.getSeconds();
    let pad = (n) => n<10 ? '0'+n : n;

    return pad(hours) + ":" + pad(minutes) + ":" + pad(seconds);
}
