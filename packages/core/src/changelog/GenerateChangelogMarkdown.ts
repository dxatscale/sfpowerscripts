import { ReleaseChangelog, Release } from "./interfaces/ReleaseChangelogInterfaces"

export default function generateMarkdown(releaseChangelog: ReleaseChangelog, workItemURL: string, limit: number): string {
  let payload: string = "";

  let limitReleases: number;
  if (limit <= releaseChangelog["releases"].length)
     limitReleases = releaseChangelog["releases"].length - limit;
  else
     limitReleases = 0;

  // Start from latest Release
  for (let releaseNum = releaseChangelog["releases"].length - 1 ; releaseNum >= limitReleases ; releaseNum-- ) {
      let release: Release = releaseChangelog["releases"][releaseNum];

      payload += `\n# ${release["name"]}\n`;

      payload += "## Artifacts\n";
      for (let artifactNum = 0 ; artifactNum < release["artifacts"].length ; artifactNum++) {
          payload += `**${release["artifacts"][artifactNum]["name"]}**     v${release["artifacts"][artifactNum]["version"]} (${release["artifacts"][artifactNum]["to"]})\n\n`;
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
  return payload;
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
