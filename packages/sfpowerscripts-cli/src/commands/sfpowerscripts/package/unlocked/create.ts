import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import { flags } from "@salesforce/command";
import { Messages } from "@salesforce/core";
import CreateUnlockedPackageImpl from "@dxatscale/sfpowerscripts.core/lib/package/packageCreators/CreateUnlockedPackageImpl";
import PackageCreateCommand from "../../../../PackageCreateCommand";
import {
  COLOR_SUCCESS,
  ConsoleLogger,
} from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages(
  "@dxatscale/sfpowerscripts",
  "create_unlocked_package"
);

export default class CreateUnlockedPackage extends PackageCreateCommand {
  public static description = messages.getMessage("commandDescription");


  protected static requiresUsername = false;
  protected static requiresDevhubUsername = true;
  protected static requiresProject = true;


  public static examples = [
    `$ sfdx sfpowerscripts:package:unlocked:create -n <packagealias> -b -x -v <devhubalias> --refname <name>`,
    `$ sfdx sfpowerscripts:package:unlocked:create -n <packagealias> -b -x -v <devhubalias> --diffcheck --gittag\n`,
    `Output variable:`,
    `sfpowerscripts_package_version_id`,
    `<refname>_sfpowerscripts_package_version_id`,
    `sfpowerscripts_artifact_metadata_directory`,
    `<refname>_sfpowerscripts_artifact_metadata_directory`,
    `sfpowerscripts_artifact_directory`,
    `<refname>_sfpowerscripts_artifact_directory`,
    `sfpowerscripts_package_version_number`,
    `<refname>_sfpowerscripts_package_version_number`,
  ];

  protected static flagsConfig = {
    package: flags.string({
      required: true,
      char: "n",
      description: messages.getMessage("packageFlagDescription"),
    }),
    buildartifactenabled: flags.boolean({
      char: "b",
      description: messages.getMessage("buildArtifactEnabledFlagDescription"),
      deprecated: {
        messageOverride:
          "--buildartifactenabled is deprecated. Artifacts are always created",
      },
    }),
    installationkey: flags.string({
      char: "k",
      description: messages.getMessage("installationKeyFlagDescription"),
      exclusive: ["installationkeybypass"],
    }),
    installationkeybypass: flags.boolean({
      char: "x",
      description: messages.getMessage("installationKeyBypassFlagDescription"),
      exclusive: ["installationkey"],
    }),
    diffcheck: flags.boolean({
      description: messages.getMessage("diffCheckFlagDescription"),
    }),
    gittag: flags.boolean({
      description: messages.getMessage("gitTagFlagDescription"),
    }),
    repourl: flags.string({
      char: "r",
      description: messages.getMessage("repoUrlFlagDescription"),
    }),
    versionnumber: flags.string({
      description: messages.getMessage("versionNumberFlagDescription"),
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
    enablecoverage: flags.boolean({
      description: messages.getMessage("enableCoverageFlagDescription"),
    }),
    isvalidationtobeskipped: flags.boolean({
      char: "s",
      description: messages.getMessage(
        "isValidationToBeSkippedFlagDescription"
      ),
    }),
    branch: flags.string({
      description: messages.getMessage("branchFlagDescription"),
    }),
    tag: flags.string({
      description: messages.getMessage("tagFlagDescription"),
    }),
    waittime: flags.string({
      description: messages.getMessage("waitTimeFlagDescription"),
      default: "120",
    }),
    refname: flags.string({
      description: messages.getMessage("refNameFlagDescription"),
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
    }),
  };
  


  public async create(): Promise<PackageMetadata> {
    let tag: string = this.flags.tag;
    let installationkeybypass = this.flags.installationkeybypass;
    let isCoverageEnabled: boolean = this.flags.enablecoverage;
    let isSkipValidation: boolean = this.flags.isvalidationtobeskipped;
    let installationkey = this.flags.installationkey;
    let waitTime= this.flags.waittime;
    

    //Handle Installation Keys
    if(installationkey === null || installationkey === undefined)
    {
     installationkeybypass=true;
    }
    

    let packageMetadata: PackageMetadata = {
      package_name: this.sfdxPackage,
      package_type: "unlocked",
      package_version_number: this.versionNumber,
      sourceVersion: this.commitId,
      repository_url: this.repositoryURL,
      tag: tag,
      branch: this.branch,
    };

    let createUnlockedPackageImpl: CreateUnlockedPackageImpl = new CreateUnlockedPackageImpl(
      this.sfdxPackage,
      this.versionNumber,
      this.getConfigFilePath(),
      installationkeybypass,
      installationkey,
      null,
      this.hubOrg.getUsername(),
      waitTime,
      isCoverageEnabled,
      isSkipValidation,
      packageMetadata,
      null,
      new ConsoleLogger()
    );

    let result = await createUnlockedPackageImpl.exec();
    console.log(
      COLOR_SUCCESS(`Created unlocked package ${packageMetadata.package_name}`)
    );
    return result;
  }

  protected getConfigFilePath(): string {
     return this.flags.configfilepath;
  }  
}
