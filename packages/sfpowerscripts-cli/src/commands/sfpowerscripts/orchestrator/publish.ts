import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import * as fs from "fs-extra"
import path = require("path");
import ArtifactFilePathFetcher, {ArtifactFilePaths} from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import child_process = require("child_process");
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender";
import SFPLogger, { COLOR_ERROR, COLOR_HEADER,COLOR_KEY_MESSAGE, COLOR_SUCCESS, COLOR_TIME } from '@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger';
import getFormattedTime from '../../../utils/GetFormattedTime';
import simplegit from "simple-git";
import GitIdentity from "../../../impl/git/GitIdentity";

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'publish');

export default class Promote extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:orchestrator:publish -f path/to/script`,
    `$ sfdx sfpowerscripts:orchestrator:publish --npm`,
    `$ sfdx sfpowerscripts:orchestrator:publish -f path/to/script -p -v HubOrg`,
    `$ sfdx sfpowerscripts:orchestrator:publish -f path/to/script --gittag --pushgittag`
  ];

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  protected static flagsConfig = {
    artifactdir: flags.directory({
      required: true,
      char: 'd',
      description: messages.getMessage('artifactDirectoryFlagDescription'),
      default: 'artifacts'
    }),
    publishpromotedonly: flags.boolean({
      char: 'p',
      description: messages.getMessage('publishPromotedOnlyFlagDescription'),
      dependsOn: ['devhubalias'],
    }),
    devhubalias: flags.string({
      char: 'v',
      description: messages.getMessage('devhubAliasFlagDescription'),
    }),
    scriptpath: flags.filepath({
      char: 'f',
      description: messages.getMessage('scriptPathFlagDescription')
    }),
    tag: flags.string({
      char: 't',
      description: messages.getMessage('tagFlagDescription')
    }),
    gittag: flags.boolean({
      description: messages.getMessage('gitTagFlagDescription'),
      default: false,
    }),
    pushgittag: flags.boolean({
      description: messages.getMessage('gitPushTagFlagDescription'),
      default: false,
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
    npmtag: flags.string({
      description: messages.getMessage('npmTagFlagDescription'),
      dependsOn: ['npm'],
      required: false,
      deprecated: {
        messageOverride:
          "--npmtag is deprecated, sfpowerscripts will automatically tag the artifact with the branch name",
      },
    }),
    npmrcpath: flags.filepath({
      description: messages.getMessage('npmrcPathFlagDescription'),
      dependsOn: ['npm'],
      required: false
    }),
    loglevel: flags.enum({
      description: "logging level for this command invocation",
      default: "info",
      required: false,
      options: [
        "trace",
        "debug",
        "info",
        "warn",
        "error",
        "fatal",
        "TRACE",
        "DEBUG",
        "INFO",
        "WARN",
        "ERROR",
        "FATAL",
      ],
    })
  };


  public async execute(){

    let nPublishedArtifacts: number = 0;
    let failedArtifacts: string[] = [];


    let executionStartTime = Date.now();

    let succesfullyPublishedPackageNamesForTagging: {
      name: string,
      version: string,
      type: string,
      tag: string
    }[] = new Array();

    let npmrcFilesToCleanup: string[] = [];

    try {

    SFPLogger.log(COLOR_HEADER(`command: ${COLOR_KEY_MESSAGE(`publish`)}`));
    SFPLogger.log(COLOR_HEADER(`target: ${this.flags.scriptpath ? this.flags.scriptpath : "NPM"}`));
    SFPLogger.log(COLOR_HEADER(`Publish promoted artifacts only: ${this.flags.publishpromotedonly ? true : false}`));
    SFPLogger.log(
      COLOR_HEADER(
        `-------------------------------------------------------------------------------------------`
      )
    );
      let packageVersionList: any;
      if (this.flags.publishpromotedonly) {
        let packageVersionListJson: string = child_process.execSync(
          `sfdx force:package:version:list --released -v ${this.flags.devhubalias} --json`,
          {
            cwd: process.cwd(),
            stdio: ['ignore', 'pipe', 'pipe'],
            encoding: 'utf8',
            maxBuffer: 5*1024*1024
          }
        );
        packageVersionList = JSON.parse(packageVersionListJson);
      }

      let artifacts = ArtifactFilePathFetcher.findArtifacts(this.flags.artifactdir);
      let artifactFilePaths = ArtifactFilePathFetcher.fetchArtifactFilePaths(this.flags.artifactdir);

      // Pattern captures two named groups, the "package" name and "version" number
      let pattern = new RegExp("(?<package>^.*)(?:_sfpowerscripts_artifact_)(?<version>.*)(?:\\.zip)");
      for (let artifact of artifacts) {
        let packageName: string;
        let packageVersionNumber: string;

        let match: RegExpMatchArray = path.basename(artifact).match(pattern);

        if (match !== null) {
          packageName = match.groups.package;
          packageVersionNumber = match.groups.version;
        } else {
          // artifact filename doesn't match pattern
          continue;
        }

        let {sourceDirectory, packageMetadata} = this.getPackageInfo(
          artifactFilePaths,
          packageName,
          packageVersionNumber
        );

        let packageType = packageMetadata.package_type;
        let packageVersionId = packageMetadata.package_version_id;

        if (this.flags.publishpromotedonly && packageType === "unlocked") {
          let isReleased = this.isPackageVersionIdReleased(packageVersionList, packageVersionId);

          if (!isReleased) {
            failedArtifacts.push(`${packageName} v${packageVersionNumber}`);
            SFPLogger.log(`Skipping ${packageName} Version ${packageVersionNumber}. Package Version Id ${packageVersionId} has not been promoted.`);
            process.exitCode = 1;
            continue;
          }
        }

        try {
          if (this.flags.npm) {
            this.publishUsingNpm(
              sourceDirectory,
              packageName,
              packageVersionNumber,
              packageMetadata,
              npmrcFilesToCleanup
            );
          } else {
            this.publishUsingScript(
              packageName,
              packageVersionNumber,
              artifact
            );
          }

          succesfullyPublishedPackageNamesForTagging.push({
            name:packageName,
            version:packageVersionNumber.replace("-", "."),
            type: packageType,
            tag:`${packageName}_v${packageVersionNumber.replace("-", ".")}`
          });

          nPublishedArtifacts++;
        } catch (err) {
          failedArtifacts.push(`${packageName} v${packageVersionNumber}`);
          SFPLogger.log(err.message);
          process.exitCode = 1;
        }
      }

      if (this.flags.gittag && failedArtifacts.length == 0) {
        await this.createGitTags(succesfullyPublishedPackageNamesForTagging);
        await this.pushGitTags();
      }


    } catch (err) {
      SFPLogger.log(err.message);

      // Fail the task when an error occurs
      process.exitCode = 1;
    } finally {

      if (npmrcFilesToCleanup.length > 0) {
        npmrcFilesToCleanup.forEach((npmrcFile) => {
          fs.unlinkSync(npmrcFile);
        });
      }

      let totalElapsedTime: number = Date.now() - executionStartTime;

      SFPLogger.log(COLOR_HEADER(
        `----------------------------------------------------------------------------------------------------`
      ));
      SFPLogger.log(COLOR_SUCCESS(
        `${nPublishedArtifacts} artifacts published in ${COLOR_TIME(getFormattedTime(totalElapsedTime))} with {${COLOR_ERROR(failedArtifacts.length)}} errors`
      ));



      if (failedArtifacts.length > 0) {
        SFPLogger.log(COLOR_ERROR(`Packages Failed to Publish`, failedArtifacts));
      }
      SFPLogger.log(COLOR_HEADER(
        `----------------------------------------------------------------------------------------------------`
      ));

      let tags = {
        publish_promoted_only: this.flags.publishpromotedonly ? "true" : "false"
      };

      if (this.flags.tag != null) {
        tags["tag"] = this.flags.tag;
      }

      SFPStatsSender.logGauge(
        "publish.duration",
        totalElapsedTime,
        tags
      );

      SFPStatsSender.logGauge(
        "publish.succeeded",
        nPublishedArtifacts,
        tags
      );

      if (failedArtifacts.length > 0) {
        SFPStatsSender.logGauge(
          "publish.failed",
          failedArtifacts.length,
          tags
        );
      }
    }
  }

  private publishUsingNpm(
    sourceDirectory: string,
    packageName: string,
    packageVersionNumber: string,
    packageMetadata: PackageMetadata,
    npmrcFilesToCleanup: string[]
  ) {
    let artifactRootDirectory = path.dirname(sourceDirectory);

    // NPM does not accept packages with uppercase characters
    let name: string = packageName.toLowerCase() + "_sfpowerscripts_artifact";

    if (this.flags.scope)
      name = `@${this.flags.scope}/` + name;

    let packageJson = {
      name: name,
      version: packageVersionNumber,
      repository: packageMetadata.repository_url
    };

    fs.writeFileSync(
      path.join(artifactRootDirectory, "package.json"),
      JSON.stringify(packageJson, null, 4)
    );

    if (this.flags.npmrcpath) {
      fs.copyFileSync(
        this.flags.npmrcpath,
        path.join(artifactRootDirectory, ".npmrc")
      );

      npmrcFilesToCleanup.push(
        path.join(artifactRootDirectory, ".npmrc")
      );
    }

    let cmd = `npm publish`;

    //Do a tag based on the branch
    if(packageMetadata.branch) {
     cmd += ` --tag ${packageMetadata.branch}`;
     SFPLogger.log(COLOR_KEY_MESSAGE(`Publishing ${packageName} Version ${packageVersionNumber} with tag ${packageMetadata.branch}...`));
    }

    child_process.execSync(
      cmd,
      {
        cwd: artifactRootDirectory,
        stdio: "pipe"
      }
    );
  }

  private publishUsingScript(
    packageName: string,
    packageVersionNumber: string,
    artifact: string
  ) {
    let cmd: string;
    if (process.platform !== 'win32') {
      cmd = `sh -e ${this.flags.scriptpath} ${packageName} ${packageVersionNumber} ${artifact} ${this.flags.publishpromotedonly ? true : false}`;
    } else {
      cmd = `cmd.exe /c ${this.flags.scriptpath} ${packageName} ${packageVersionNumber} ${artifact} ${this.flags.publishpromotedonly ? true : false}`;
    }

    SFPLogger.log(COLOR_KEY_MESSAGE(`Publishing ${packageName} Version ${packageVersionNumber}...`));

    child_process.execSync(
      cmd,
      {
        cwd: process.cwd(),
        stdio: ['ignore', 'inherit', 'inherit']
      }
    );
  }

  protected validateFlags() {
    if (this.flags.scriptpath === undefined && this.flags.npm === undefined)
      throw new Error("Either --scriptpath or --npm flag must be provided");

    if (this.flags.scriptpath && !fs.existsSync(this.flags.scriptpath))
      throw new Error(`Script path ${this.flags.scriptpath} does not exist`);

    if (this.flags.npm && !this.flags.scope)
      throw new Error("--scope parameter is required for NPM");
  }

  private async pushGitTags() {
    SFPLogger.log(COLOR_KEY_MESSAGE("Pushing Git Tags to Repo"));
    if(this.flags.pushgittag)
    {
      let git = simplegit();
      await git.pushTags();
    }
  }

  private async createGitTags(
    succesfullyPublishedPackageNamesForTagging: {
      name: string,
      version: string,
      type: string,
      tag: string
    }[]
  ) {
      SFPLogger.log(COLOR_KEY_MESSAGE("Creating Git Tags in Repo"));

      let git = simplegit();

      await new GitIdentity(git).setUsernameAndEmail();

      for (let packageTag of succesfullyPublishedPackageNamesForTagging) {
        await git.addAnnotatedTag(packageTag.tag, `${packageTag.name} ${packageTag.type} Package ${packageTag.version}`);
      }

  }

  private isPackageVersionIdReleased(packageVersionList: any, packageVersionId: string): boolean {
    let packageVersion = packageVersionList.result.find((pkg) => {
      return pkg.SubscriberPackageVersionId === packageVersionId;
    });

    if (packageVersion)
      return true
    else
      return false
  }

  /**
   * Get sourceDirectory and packageMetadata of artifact with package name and version
   * @param artifacts
   * @param packageName
   * @param packageVersionNumber
   */
  private getPackageInfo(
    artifacts: ArtifactFilePaths[],
    packageName,
    packageVersionNumber
  ): {sourceDirectory: string, packageMetadata: PackageMetadata }{
    for (let artifact of artifacts) {
      let packageMetadata: PackageMetadata = JSON.parse(fs.readFileSync(artifact.packageMetadataFilePath, 'utf8'));
      if (
        packageMetadata.package_name === packageName &&
        packageMetadata.package_version_number === packageVersionNumber.replace("-", ".")
      ) {
        return { sourceDirectory: artifact.sourceDirectoryPath, packageMetadata: packageMetadata };
      }
    }

    throw new Error(`Unable to find artifact metadata for ${packageName} Version ${packageVersionNumber.replace("-", ".")}`);
  }


}
