import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import { ReleaseChangelog, Release } from "@dxatscale/sfpowerscripts.core/lib/changelog/interfaces/ReleaseChangelogInterfaces";
import { Changelog as PackageChangelog } from "@dxatscale/sfpowerscripts.core/lib/changelog/interfaces/GenericChangelogInterfaces";
import generateMarkdown from "@dxatscale/sfpowerscripts.core/lib/changelog/GenerateChangelogMarkdown";
import fs = require("fs-extra");
import path = require('path');
import simplegit, { SimpleGit } from "simple-git/promise";
const tmp = require('tmp');
const glob = require("glob");


Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'generate_changelog');

export default class GenerateChangelog extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:GenerateChangelog -n <releaseName> -d path/to/artifact/directory -w <regexp> -r <repoURL> -b <branchName> `
  ];

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  protected static flagsConfig = {
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
      description: messages.getMessage('workItemUrlFlagDescription')
    }),
    repourl: flags.string({
      required: true,
      char: "r",
      description: messages.getMessage('repoUrlFlagDescription')
    }),
    branchname: flags.string({
      required: true,
      char: "b",
      description: messages.getMessage('branchNameFlagDescription')
    }),
    forcepush: flags.boolean({
      description: messages.getMessage('forcePushFlagDescription'),
      hidden: true,
      default: false
    })
  };


  public async run(){
    let tempDir = tmp.dirSync({unsafeCleanup: true});
    try {
      let git: SimpleGit = simplegit();

      console.log(`Cloning repository ${this.flags.repourl}`);
      await git.clone(
        this.flags.repourl,
        tempDir.name
      );
      const repoTempDir = tempDir.name;

      console.log(`Checking out branch ${this.flags.branchname}`);
      git = simplegit(repoTempDir);
      await git.checkout(this.flags.branchname);


      let packageMetadataFilepaths: string[] = glob.sync(
        `**/artifact_metadata.json`,
        {
          cwd: path.resolve(process.cwd(), this.flags.artifactdir),
          absolute: true
        }
      );

      let packageChangelogMap: {[P:string]: string} = {};
      let latestReleaseDefinition: Release = {
        name: this.flags.releasename,
        workItems: {},
        artifacts: []
      };

      // Read artifacts for latest release definition
      for (let packageMetadataFilepath of packageMetadataFilepaths ) {
        let packageMetadata: PackageMetadata = JSON.parse(fs.readFileSync(packageMetadataFilepath, 'utf8'));
        latestReleaseDefinition["artifacts"].push({
          name: packageMetadata["package_name"],
          from: undefined,
          to: packageMetadata["sourceVersion"]?.slice(0,8) || packageMetadata["sourceVersionTo"]?.slice(0,8),
          version: packageMetadata["package_version_number"],
          latestCommitId: undefined,
          commits: undefined
        });

        packageChangelogMap[packageMetadata["package_name"]] = path.join(
          path.dirname(packageMetadataFilepath),
          `changelog.json`
        );
      }

      console.log("Generating changelog...");

      // Check if any packages are missing changelog
      Object.values(packageChangelogMap).forEach( (changelogPath) => {
        if (!fs.existsSync(changelogPath)) {
          throw Error("Artifact is missing changelog. Check build task version compatability");
        }
      });

      // Get artifact versions from previous release definition
      let prevReleaseDefinition: Release;
      let releaseChangelog: ReleaseChangelog;
      if (fs.existsSync(path.join(repoTempDir,`releasechangelog.json`))) {
        releaseChangelog = JSON.parse(fs.readFileSync(path.join(repoTempDir,`releasechangelog.json`), 'utf8'));
        if (releaseChangelog["releases"].length > 0) {
          prevReleaseDefinition = releaseChangelog["releases"][releaseChangelog["releases"].length - 1];
        }
      }

      let prevReleaseLatestCommitId: {[P: string]: string} = {}
      if (prevReleaseDefinition) {
        for (let artifact of latestReleaseDefinition["artifacts"]) {
          for (let prevReleaseArtifact of prevReleaseDefinition["artifacts"]) {
            if (artifact["name"] === prevReleaseArtifact["name"]) {
              // Verify that this modifies latestReleaseDefinition
              artifact["from"] = prevReleaseArtifact["to"];
              prevReleaseLatestCommitId[artifact["name"]] = prevReleaseArtifact["latestCommitId"];
              break;
            }
          }
        }
      }

      // Get commits for the latest release
      for (let artifact of latestReleaseDefinition["artifacts"]) {
        let packageChangelog: PackageChangelog = JSON.parse(fs.readFileSync(packageChangelogMap[artifact["name"]], 'utf8'));

        artifact["latestCommitId"] = packageChangelog["commits"][0]["commitId"];

        let fromIdx;
        if (artifact["from"]) {
          fromIdx = packageChangelog["commits"].findIndex( (commit) =>
            commit["commitId"] === prevReleaseLatestCommitId[artifact["name"]]
          );
          if (fromIdx === -1)
            throw Error(`Cannot find commit Id ${prevReleaseLatestCommitId[artifact["name"]]} in ${artifact["name"]} changelog`);
        }


        if (fromIdx > 0) {
          artifact["commits"] = packageChangelog["commits"].slice(0, fromIdx);
        } else if (fromIdx === 0) {
          // Artifact verison has not changed
          artifact["commits"] = [];
          // Skip to next artifact
          continue;
        } else if (fromIdx === undefined ) {
          // Artifact was not in previous release
          artifact["commits"] = packageChangelog["commits"];
        }


        // Compute work items for latest release
        let workItemFilter: RegExp = RegExp(this.flags.workitemfilter, 'gi');
        for (let commit of artifact["commits"]) {
          let commitMessage: String = commit["message"] + "\n" + commit["body"];
          let workItems: RegExpMatchArray = commitMessage.match(workItemFilter);
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

      // Convert each work item Set to Array
      // Enables JSON stringification of work item
      for (let key in latestReleaseDefinition["workItems"]) {
        latestReleaseDefinition["workItems"][key] = Array.from(latestReleaseDefinition["workItems"][key]);
      }

      // Append results to release changelog
      if (releaseChangelog) {
        releaseChangelog["releases"].push(latestReleaseDefinition);
      } else {
        releaseChangelog = {
          releases: [latestReleaseDefinition]
        }
      }

      fs.writeFileSync(
        path.join(repoTempDir,`releasechangelog.json`),
        JSON.stringify(releaseChangelog, null, 4)
      );

      let payload: string = generateMarkdown(releaseChangelog, this.flags.workitemurl, this.flags.limit);
      fs.writeFileSync(
        path.join(repoTempDir,`Release-Changelog.md`),
        payload
      );

      console.log("Pushing changelog files to", this.flags.repourl, this.flags.branchname);
      git = simplegit(repoTempDir);
      await git.addConfig("user.name", "sfpowerscripts");
      await git.addConfig("user.email", "sfpowerscripts@dxscale");
      await git.add([`releasechangelog.json`, `releasechangelog.md`]);
      await git.commit(`[skip ci] Updated Changelog ${this.flags.releasename}`);

      if (this.flags.forcepush) {
        await git.push(`--force`);
      } else {
        await git.push();
      }

    } catch (err) {
        console.log(err.message);
        tempDir.removeCallback();
        process.exit(1);
    } finally {
      tempDir.removeCallback();
      console.log(`Successfully generated changelog`);
    }
  }
}
