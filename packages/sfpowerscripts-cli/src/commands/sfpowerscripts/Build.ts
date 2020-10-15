import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import ArtifactGenerator from "@dxatscale/sfpowerscripts.core/lib/generators/ArtifactGenerator";
import BuildImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/BuildImpl";
import { EOL } from "os";

import { flags } from "@salesforce/command";
import SfpowerscriptsCommand from "../../SfpowerscriptsCommand";
import { Messages } from "@salesforce/core";
import { exec } from "shelljs";

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages(
  "@dxatscale/sfpowerscripts",
  "create_unlocked_package"
);

export default class Build extends SfpowerscriptsCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerscripts:Build -n <packagealias> -b -x -v <devhubalias> --refname <name>`,
    `$ sfdx sfpowerscripts:Build -n <packagealias> -b -x -v <devhubalias> --diffcheck --gittag\n`
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
    buildnumber: flags.string({
      description: messages.getMessage("waitTimeFlagDescription"),
      default: "1",
    }),
    executorcount: flags.number({
      description: messages.getMessage("waitTimeFlagDescription"),
      default: 5,
    })
  };

  public async execute() {
    try {
      const artifactDirectory: string = this.flags.artifactdir;
      const gittag: boolean = this.flags.gittag;
      const repourl: string = this.flags.repourl;
      const config_file_path = this.flags.configfilepath;
      const isSkipValidation: boolean = this.flags.isvalidationtobeskipped;
      const devhub_alias = this.flags.devhubalias;
      const wait_time = this.flags.waittime;
      const diffcheck: boolean = this.flags.diffcheck;
      const buildNumber: string = this.flags.buildnumber;
      const executorcount:number = this.flags.executorcount;

      let buildImpl = new BuildImpl(
        config_file_path,
        null,
        devhub_alias,
        repourl,
        wait_time,
        isSkipValidation,
        diffcheck,
        buildNumber,
        executorcount
      );
      let {generatedPackages, failedPackages} = await buildImpl.exec();

    
      console.log(
        `${EOL}----------------------------------------------------------------------------------------------------`
      );

      for (let generatedPackage of generatedPackages) {

       
        try {
          await ArtifactGenerator.generateArtifact(
            generatedPackage.package_name,
            process.cwd(),
            artifactDirectory,
            generatedPackage
          );
          console.log(
            `${EOL}Generated Artifact for ${generatedPackage.package_name}`
          );

          if (gittag) {
            exec(`git config --global user.email "sfpowerscripts@dxscale"`);
            exec(`git config --global user.name "sfpowerscripts"`);

            let tagname = `${generatedPackage.package_name}_v${generatedPackage.package_version_number}`;
            console.log(`Creating tag ${tagname}`);
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

      console.log(
        `${EOL}----------------------------------------------------------------------------------------------------`
      );

      if(failedPackages.length>0)
      {
        process.exit(1);
      }



    } catch (error) {
      console.log(error);
      process.exit(1);
    }
  }
}
