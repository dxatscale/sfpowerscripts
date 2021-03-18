import child_process = require("child_process");
const yaml = require('js-yaml');
import * as fs from "fs-extra";
import path = require("path");
const Validator = require('jsonschema').Validator;
import Git from "@dxatscale/sfpowerscripts.core/lib/utils/Git";
import GitTags from "@dxatscale/sfpowerscripts.core/lib/utils/GitTags";

export default class FetchImpl {
  constructor(
    private releaseDefinition: string,
    private artifactDirectory: string,
    private scriptPath: string,
    private isNpm: boolean,
    private scope: string,
    private npmrcPath: string
  ){}

  async exec() {
    let releaseDefinition: ReleaseDefinition = yaml.load(fs.readFileSync(this.releaseDefinition, 'utf8'))
    this.validateReleaseDefinition(releaseDefinition, this.isNpm);

    fs.mkdirpSync(this.artifactDirectory);

    if (this.isNpm) {
      if (this.npmrcPath) {
        fs.copyFileSync(
          this.npmrcPath,
          path.resolve(".npmrc")
        );

        if (!fs.existsSync("package.json")) {
          // package json is required in the same directory as .npmrc
          fs.writeFileSync("package.json", "{}");
        }
      }

      await this.fetchArtifactsFromNpm(
        releaseDefinition,
        this.artifactDirectory,
        this.scope
      );

     } else {
      await this.fetchArtifactsFromScript(
        releaseDefinition,
        this.artifactDirectory
      );
     }
  }

  private async fetchArtifactsFromNpm(
    releaseDefinition: ReleaseDefinition,
    artifactDirectory: string,
    scope: string
  ): Promise<void> {
    const git: Git = new Git(null);

    for (let artifact of Object.entries<string>(releaseDefinition.artifacts)) {
      let version: string;
      if (artifact[1] === "LATEST_TAG") {
        version = await this.getVersionFromLatestTag(git, artifact[0]);
      } else
        version = artifact[1];

      // NPM package names must be lowercase
      let packageName = artifact[0].toLowerCase();
      let cmd = `npm pack @${scope}/${packageName}_sfpowerscripts_artifact@${version}`
      child_process.execSync(
        cmd,
        {
          cwd: artifactDirectory,
          stdio: ["ignore", "inherit", "inherit"],
        }
      );
    }
  }

  private async fetchArtifactsFromScript(
    releaseDefinition: ReleaseDefinition,
    artifactDirectory: string
  ): Promise<void> {
    const git: Git = new Git(null);

    for (let artifact of Object.entries<string>(releaseDefinition.artifacts)) {
      let version: string;
      if (artifact[1] === "LATEST_TAG") {
        version = await this.getVersionFromLatestTag(git, artifact[0]);
      } else
        version = artifact[1];

      let cmd: string;
      if (process.platform !== 'win32') {
        cmd = `bash -e ${this.scriptPath} ${artifact[0]} ${version} ${artifactDirectory}`;
      } else {
        cmd = `cmd.exe /c ${this.scriptPath} ${artifact[0]} ${version} ${artifactDirectory}`;
      }

      child_process.execSync(
        cmd,
        {
          cwd: process.cwd(),
          stdio: ['ignore', 'inherit', 'inherit']
        }
      );
    }
  }

  private async getVersionFromLatestTag(
    git: Git,
    packageName: string
  ): Promise<string> {
    let version: string;

    let gitTags = new GitTags(git, packageName);
    let tags = await gitTags.listTagsOnBranch();
    let latestTag = tags.pop();

    if (latestTag) {
      let match: RegExpMatchArray = latestTag.match(
        /^.*_v(?<version>[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+|\.LATEST|\.NEXT)?)$/
      );
      if (match)
        version = this.substituteBuildNumberWithPreRelease(
          match.groups.version
        );
      else
       throw new Error(`Failed to find valid tag for ${packageName}`);

    } else throw new Error(`Failed to find latest tag for ${packageName}`);

    return version;
  }

  private validateReleaseDefinition(
    releaseDefinition: ReleaseDefinition,
    isNpm: boolean
  ): void {
    let v = new Validator();

    let versionPattern: RegExp;
    if (isNpm) {
      versionPattern = /(^[0-9]+\.[0-9]+\.[0-9]+(-.+)?)|^LATEST_TAG$|^[a-zA-Z0-9]+$/
    } else {
      versionPattern = /(^[0-9]+\.[0-9]+\.[0-9]+(-.+)?)|^LATEST_TAG$/
    }

    const schema = {
        "type": "object",
        "properties": {
            "release": {
                "type": "string"
            },
            "artifacts": {
                "type": "object",
                "patternProperties": {
                  ".+": {
                    "type": "string",
                    "pattern": versionPattern
                  }
                }
            }
        },
        "additionalProperties": false,
        "required": [
            "release",
            "artifacts",
        ]
    };

    let validationResult = v.validate(releaseDefinition, schema);
    if (validationResult.errors.length > 0) {
        let errorMsg: string =
            `Release definition does not meet schema requirements, ` +
            `found ${validationResult.errors.length} validation errors:\n`;

        validationResult.errors.forEach( (error, errorNum) => {
            errorMsg += `\n${errorNum+1}. ${error.stack}`;
            if (error.instance != null)
                errorMsg += `\nReceived: ${JSON.stringify(error.instance)}\n`;
        });
        throw new Error(errorMsg);
    }
  }

  private substituteBuildNumberWithPreRelease(
    packageVersionNumber: string
  ) {
    let segments = packageVersionNumber.split(".");

    if (segments.length === 4) {
      packageVersionNumber = segments.reduce(
        (version, segment, segmentsIdx) => {
          if (segmentsIdx === 3) return version + "-" + segment;
          else return version + "." + segment;
        }
      );
    }

    return packageVersionNumber;
  }
}

interface ReleaseDefinition {
  release: string,
  artifacts: {
    [p: string]: string
  }
}
