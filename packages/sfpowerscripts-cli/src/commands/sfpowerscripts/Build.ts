import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import ArtifactGenerator from "@dxatscale/sfpowerscripts.core/lib/generators/ArtifactGenerator";
import BuildImpl from "@dxatscale/sfpowerscripts.core/lib/parallelBuilder/BuildImpl";
import { EOL } from "os";

import { flags } from "@salesforce/command";
import SfpowerscriptsCommand from "../../SfpowerscriptsCommand";
import { Messages } from "@salesforce/core";
import { exec } from "shelljs";
import fs = require("fs");
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/utils/SFPStatsSender";

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages("@dxatscale/sfpowerscripts", "build");

export default class Build extends SfpowerscriptsCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerscripts:Build -n <packagealias> -b -x -v <devhubalias> --refname <name>`,
    `$ sfdx sfpowerscripts:Build -n <packagealias> -b -x -v <devhubalias> --diffcheck --gittag\n`,
  ];

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  protected static flagsConfig = {
    devhubalias: flags.string({
      char: "v",
      description: messages.getMessage("devhubAliasFlagDescription"),
      default: "HubOrg",
    }),
    diffcheck: flags.boolean({
      description: messages.getMessage("diffCheckFlagDescription"),
      default: false
    }),
    gittag: flags.boolean({
      description: messages.getMessage("gitTagFlagDescription"),
      default: false,
    }),
    repourl: flags.string({
      char: "r",
      description: messages.getMessage("repoUrlFlagDescription"),
    }),
    configfilepath: flags.filepath({
      char: "f",
      description: messages.getMessage("configFilePathFlagDescription"),
      default: "config/project-scratch-def.json",
    }),
    artifactdir: flags.directory({
      description: messages.getMessage("artifactDirectoryFlagDescription"),
      default: "artifacts",
    }),
    isvalidationtobeskipped: flags.boolean({
      char: "s",
      description: messages.getMessage(
        "isValidationToBeSkippedFlagDescription"
      ),
    }),
    waittime: flags.string({
      description: messages.getMessage("waitTimeFlagDescription"),
      default: "120",
    }),
    buildnumber: flags.number({
      description: messages.getMessage("buildNumberFlagDescription"),
      default: 1,
    }),
    executorcount: flags.number({
      description: messages.getMessage("executorCountFlagDescription"),
      default: 5,
    }),
    branch:flags.string({
      description:messages.getMessage("branchFlagDescription"),
    }),
    tag:flags.string({
      description:messages.getMessage("tagFlagDescription"),
    }),
    validatemode: flags.boolean({
      description: messages.getMessage("executorCountFlagDescription"),
      hidden: true,
      default: false,
    }),
  };

  public async execute() {
    try {
      const artifactDirectory: string = this.flags.artifactdir;
      const gittag: boolean = this.flags.gittag;
      const repourl: string = this.flags.repourl;
      const config_file_path = this.flags.configfilepath;
      let   isSkipValidation: boolean = this.flags.isvalidationtobeskipped;
      const devhub_alias = this.flags.devhubalias;
      const wait_time = this.flags.waittime;
      const diffcheck: boolean = this.flags.diffcheck;
      const buildNumber: number = this.flags.buildnumber;
      const executorcount: number = this.flags.executorcount;
      const isValidateMode: boolean = this.flags.validatemode;
      const branch:string=this.flags.branch;

      if(isValidateMode)
        isSkipValidation=true;

      console.log(
        "-----------sfpowerscripts package builder------------------"
      );




      let executionStartTime = Date.now();

      let buildImpl = new BuildImpl(
        config_file_path,
        null,
        devhub_alias,
        repourl,
        wait_time,
        isSkipValidation,
        diffcheck,
        buildNumber,
        executorcount,
        isValidateMode,
        branch
      );
      let { generatedPackages, failedPackages } = await buildImpl.exec();

      if (
        diffcheck &&
        generatedPackages.length == 0 &&
        failedPackages.length == 0
      ) {
        console.log(`${EOL}${EOL}`);
        console.log("No packages found to be built.. .. ");
        return;
      }

      console.log(`${EOL}${EOL}`);
      console.log("Generating Artifacts and Tags....");

      const buildResult: BuildResult = {
        packages: [],
        summary: {
          scheduled_packages: null,
          elapsed_time: null,
          succeeded: null,
          failed: null
        }
      };

      for (let generatedPackage of generatedPackages) {
        try {
          let artifactFilepaths = await ArtifactGenerator.generateArtifact(
            generatedPackage.package_name,
            process.cwd(),
            artifactDirectory,
            generatedPackage
          );

          try {
            let packageMetadata: PackageMetadata = JSON.parse(
              fs.readFileSync(artifactFilepaths.artifactMetadataFilePath, "utf8")
            );

            buildResult["packages"].push({
              name: packageMetadata["package_name"],
              version: packageMetadata["package_version_number"],
              elapsed_time: packageMetadata["creation_details"]?.creation_time,
              status: "succeeded"
            });
          } catch (err) {
            console.log(`Failed to parse ${artifactFilepaths.artifactMetadataFilePath}`);
          }

          if (gittag) {
            exec(`git config --global user.email "sfpowerscripts@dxscale"`);
            exec(`git config --global user.name "sfpowerscripts"`);

            let tagname = `${generatedPackage.package_name}_v${generatedPackage.package_version_number}`;
            exec(
              `git tag -a -m "${generatedPackage.package_name} ${generatedPackage.package_type} Package ${generatedPackage.package_version_number}" ${tagname} HEAD`,
              { silent: false }
            );
          }
        } catch (error) {
          console.log(
            `Unable to create artifact or tag for ${generatedPackage.package_name}`
          );
          console.log(error);
        }
      }

      for (let failedPackage of failedPackages) {
        buildResult["packages"].push({
          name: failedPackage,
          version: null,
          elapsed_time: null,
          status: "failed"
        })
      }

      let totalElapsedTime: number = Date.now() - executionStartTime;
      buildResult["summary"].scheduled_packages = generatedPackages.length + failedPackages.length;
      buildResult["summary"].elapsed_time = totalElapsedTime;
      buildResult["summary"].succeeded = generatedPackages.length;
      buildResult["summary"].failed = failedPackages.length;

      fs.writeFileSync(`buildResult.json`, JSON.stringify(buildResult, null, 4));

      let tags = {
        is_diffcheck_enabled: String(diffcheck),
        is_dependency_validated: isSkipValidation ? "false" : "true",
        pr_mode: String(isValidateMode),
        branch: branch
      };

     if(!(this.flags.tag==null || this.flags.tag==undefined))
     {
       tags["tag"]=this.flags.tag;
     }

      console.log("Sending Metrics if enabled..",tags);
      SFPStatsSender.logGauge(
        "build.duration",
        (Date.now() - executionStartTime),
        tags
      );

      if(!diffcheck && !isSkipValidation)
      {
      SFPStatsSender.logGauge(
        "build.elapsed_time",
        (Date.now() - executionStartTime)
      );
      }

      console.log(
        `----------------------------------------------------------------------------------------------------`
      );
      console.log(
        `${
          generatedPackages.length
        } packages created in ${this.getFormattedTime(
          totalElapsedTime
        )} minutes with {${failedPackages.length}} errors`
      );



      if (failedPackages.length > 0) {
        console.log(`Packages Failed To Build`, failedPackages);
      }
      console.log(
        `----------------------------------------------------------------------------------------------------`
      );

      if (failedPackages.length > 0) {
       process.exitCode=1;
      }
    } catch (error) {
      console.log(error);
      process.exitCode=1;
    }
  }

  private getFormattedTime(milliseconds: number): string {
    let date = new Date(0);
    date.setSeconds(milliseconds / 1000); // specify value for SECONDS here
    let timeString = date.toISOString().substr(11, 8);
    return timeString;
  }
}

interface BuildResult {
  packages: {
    name: string,
    version: string,
    elapsed_time: number,
    status: string
  }[],
  summary: {
    scheduled_packages: number,
    elapsed_time: number,
    succeeded: number,
    failed: number
  }
}
