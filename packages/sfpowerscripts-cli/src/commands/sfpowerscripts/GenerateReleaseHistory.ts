import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import GenerateChangelogImpl, { Changelog } from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/GenerateChangelogImpl";
const fs = require("fs-extra");
import {isNullOrUndefined} from "util"
import simplegit, { SimpleGit } from "simple-git/promise";
const Validator = require('jsonschema').Validator;
const tmp = require('tmp');
const url = require('url');
const path = require('path');

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'generate_release_history');

export default class GenerateReleaseHistory extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:GenerateReleaseHistory -x path/to/manifest.json`
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
    })
  };


  public async run(){
    const tempDirectories = [];
    try {
        const limit: number = this.flags.limit;

        let git: SimpleGit = simplegit();

        const manifest = JSON.parse(fs.readFileSync(this.flags.manifest, "utf8"));
        validateManifest(manifest);

        // Clone git repositories
        const pkgTempDirMap: {[P: string]: string} = {};

        let tempDir: any = tmp.dirSync({unsafeCleanup: true});
        this.ux.startSpinner("Cloning repositories to tmp directory...");
        await git.clone(manifest["defaultRepository"], tempDir.name);
        const defaultRepoTempDir = tempDir.name;

        tempDirectories.push(tempDir); // Store temp directories for deletion when process exits


        if (manifest["repositories"] != null) {
            for (let repository of manifest["repositories"]) {
                tempDir = tmp.dirSync({unsafeCleanup: true});
                await git.clone(repository["url"], tempDir.name);

                // Map packages to temp directory
                for (let pkg of repository["packages"]) {
                    pkgTempDirMap[pkg] = tempDir.name;
                }

                tempDirectories.push(tempDir);
            }
        }
        this.ux.stopSpinner();

        const releaseHistory: ReleaseHistory = {
            releases: []
        };

        const workItemFilter: string = manifest["workItemFilter"];
        const workItemURL: string = manifest["workItemURL"];
        const releaseTags: string[][] = [];

        this.ux.startSpinner(`Generating release history, as per manifest ${this.flags.manifest}`);
        // Generate changelog between releases defined in manifest
        for (let releaseNum = 0 ; releaseNum < manifest["releases"].length ; releaseNum++ ) {

            // Initalise release object
            let nextRelease: release = {
                "name": manifest["releases"][releaseNum]["name"],
                "workItems": {},
                "artifacts": []
            }

            let tags: string[] = [];

            for (let artifact of manifest["releases"][releaseNum]["artifacts"]) {

                // Set project directory to artifact's repo
                let project_directory: string;
                if (pkgTempDirMap[artifact["name"]] != null) {
                    project_directory = pkgTempDirMap[artifact["name"]];
                } else {
                    project_directory = defaultRepoTempDir;
                }

                git = simplegit(project_directory);

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

                // Dereference the tag to get the commit that it points at
                let revFrom: string;
                if (artifactFromVersion != null) {
                    revFrom = await git.revparse([
                        "--short",
                        `${artifactFromVersion}^{}`
                    ]);
                }

                let revTo: string;
                try {
                    revTo = await git.revparse([
                        "--short",
                        `${artifact["version"]}^{}`
                    ]);
                } catch(revisionError) {
                    console.log(`Unable to find revision ${artifact["version"]}`);
                    throw(revisionError);
                }

                tags.push(artifact["version"]);


                // Generate changelog for single artifact between two release versions
                let generateChangelogImpl: GenerateChangelogImpl = new GenerateChangelogImpl(
                    artifact["name"],
                    revFrom,
                    revTo,
                    workItemFilter,
                    project_directory
                );

                let result: Changelog = await generateChangelogImpl.exec();

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

            releaseTags.push(tags); // Store the tag names in each release, for markdown generation

            // Convert each work item Set to Array
            // Enables JSON stringification of work item
            for (let key in nextRelease["workItems"]) {
                nextRelease["workItems"][key] = Array.from(nextRelease["workItems"][key]);
            }

            releaseHistory["releases"].push(nextRelease);
        }

        fs.writeFileSync(`releasechangelog.json`, JSON.stringify(releaseHistory, null, 4));

        generateMarkdown(releaseHistory, workItemURL, limit, releaseTags);

    } catch (err) {
        console.log(err.message);
        for (let tempdir of tempDirectories) {
            tempdir.removeCallback();
        }
        this.ux.stopSpinner("Failed");
        process.exit(1);
    } finally {
        this.ux.stopSpinner();
        console.log(`Successfully generated release history ${process.cwd()}/releasechangelog.md`);

        // Cleanup temp directory
        for (let tempdir of tempDirectories) {
            tempdir.removeCallback();
        }
    }
  }
}

function generateMarkdown(releaseHistory: ReleaseHistory, workItemURL: string, limit: number, releaseTags: string[][]): void {
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

function validateManifest(manifest): void {
    let v = new Validator();

    const releaseSchema = {
        "id": "/release",
        "type": "object",
        "properties": {
            "name": {
                "type": "string"
            },
            "artifacts": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string"
                        },
                        "version": {
                            "type": "string"
                        }
                    },
                    "additionalProperties": false,
                    "required": [
                        "name",
                        "version"
                    ]
                },
                "uniqueItems": true,
                "minItems": 1
            }
        },
        "additionalProperties": false,
        "required": [
            "name",
            "artifacts"
        ]
    };

    const manifestSchema = {
        "type": "object",
        "properties": {
            "releases": {
                "type": "array",
                "items": {
                    "$ref": "/release"
                },
                "minItems": 1
            },
            "workItemFilter": {
                "type": "string"
            },
            "workItemURL": {
                "type": "string"
            },
            "repositories": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string"
                        },
                        "url": {
                            "type": "string"
                        },
                        "packages": {
                            "type": "array",
                            "items": {
                                "type": "string"
                            },
                            "uniqueItems": true,
                            "minItems": 1
                        }
                    },
                    "additionalProperties": false,
                    "required": [
                        "url",
                        "packages"
                    ]
                },
                "uniqueItems": true,
                "minItems": 1
            },
            "defaultRepository": {
                "type": "string"
            }
        },
        "additionalProperties": false,
        "required": [
            "releases",
            "workItemFilter",
            "defaultRepository"
        ]
    };

    v.addSchema(releaseSchema, '/release');
    let validationResult = v.validate(manifest, manifestSchema);

    if (validationResult.errors.length > 0) {
        let errorMsg: string =
            `Manifest does not meet schema requirements, ` +
            `found ${validationResult.errors.length} validation errors:\n`;

        validationResult.errors.forEach( (error, errorNum) => {
            errorMsg += `\n${errorNum+1}. ${error.stack}`;
            if (!isNullOrUndefined(error.instance))
                errorMsg += `\nReceived: ${JSON.stringify(error.instance)}\n`;
        });
        throw new Error(errorMsg);
    }
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
    commitId: string,
    date: string,
    elapsedDays: string,
    author: string,
    message: string,
    body: string
}
