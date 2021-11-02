import { flags } from "@salesforce/command";
import { Messages } from "@salesforce/core";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";

import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";
import CreateDataPackageImpl from "@dxatscale/sfpowerscripts.core/lib/package/packageCreators/CreateDataPackageImpl"
import {  COLOR_SUCCESS,
  ConsoleLogger,
} from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import PackageCreateCommand from "../../../../PackageCreateCommand";

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages(
  "@dxatscale/sfpowerscripts",
  "create_data_package"
);

export default class CreateDataPackage extends PackageCreateCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerscripts:package:data:create -n mypackage -v <version>`,
    `$ sfdx sfpowerscripts:package:data:create -n <mypackage> -v <version> --diffcheck --gittag`,
    `Output variable:`,
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
    versionnumber: flags.string({
      required: true,
      char: "v",
      description: messages.getMessage("versionNumberFlagDescription"),
    }),
    artifactdir: flags.directory({
      description: messages.getMessage("artifactDirectoryFlagDescription"),
      default: "artifacts",
    }),
    diffcheck: flags.boolean({
      description: messages.getMessage("diffCheckFlagDescription"),
    }),
    branch: flags.string({
      description: messages.getMessage("branchFlagDescription"),
    }),
    gittag: flags.boolean({
      description: messages.getMessage("gitTagFlagDescription"),
    }),
    repourl: flags.string({
      char: "r",
      description: messages.getMessage("repoUrlFlagDescription"),
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

  protected async create(): Promise<PackageMetadata> {
    let packageDescriptor = ProjectConfig.getSFDXPackageDescriptor(
      null,
      this.sfdxPackage
    );
    if (packageDescriptor.type?.toLowerCase() !== "data") {
      throw new Error(
        "Data packages must have 'type' property of 'data' defined in sfdx-project.json"
      );
    }

    let packageMetadata: PackageMetadata = {
      package_name: this.sfdxPackage,
      package_version_number: this.versionNumber,
      sourceVersion: this.commitId,
      repository_url: this.repositoryURL,
      branch: this.branch,
    };

    let createDataPackageImpl = new CreateDataPackageImpl(
      null,
      this.sfdxPackage,
      packageMetadata,
      false,
      new ConsoleLogger()
    );
    packageMetadata = await createDataPackageImpl.exec();

    console.log(
      COLOR_SUCCESS(`Created data package ${packageMetadata.package_name}`)
    );
    return packageMetadata;
  }

  protected getConfigFilePath(): string {
    return null;
  }
}
