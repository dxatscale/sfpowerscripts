import { flags } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import CreateSourcePackageImpl from '@dxatscale/sfpowerscripts.core/lib/package/packageCreators/CreateSourcePackageImpl';
import { COLOR_SUCCESS, ConsoleLogger } from '@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger';
import PackageCreateCommand from '../../../../PackageCreateCommand';
import PackageMetadata from '@dxatscale/sfpowerscripts.core/lib/PackageMetadata';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'create_source_package');

export default class CreateSourcePackage extends PackageCreateCommand {


  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:package:source:create -n mypackage -v <version>`,
    `$ sfdx sfpowerscripts:package:source:create -n <mypackage> -v <version> --diffcheck --gittag`,
    `Output variable:`,
    `sfpowerscripts_artifact_metadata_directory`,
    `<refname>_sfpowerscripts_artifact_metadata_directory`,
    `sfpowerscripts_artifact_directory`,
    `<refname>_sfpowerscripts_artifact_directory`,
    `sfpowerscripts_package_version_number`,
    `<refname>_sfpowerscripts_package_version_number`
  ];

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;
  protected static requiresProject = true;

  protected static flagsConfig = {
    package: flags.string({required: true, char: 'n', description: messages.getMessage('packageFlagDescription')}),
    versionnumber: flags.string({required: true, char: 'v', description: messages.getMessage('versionNumberFlagDescription')}),
    artifactdir: flags.directory({description: messages.getMessage('artifactDirectoryFlagDescription'), default: 'artifacts'}),
    diffcheck: flags.boolean({description: messages.getMessage('diffCheckFlagDescription')}),
    branch:flags.string({
      description:messages.getMessage("branchFlagDescription"),
    }),
    gittag: flags.boolean({description: messages.getMessage('gitTagFlagDescription')}),
    repourl: flags.string({char: 'r', description: messages.getMessage('repoUrlFlagDescription')}),
    refname: flags.string({description: messages.getMessage('refNameFlagDescription')}),
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


  protected async create():Promise<PackageMetadata>{
  

        let packageMetadata:PackageMetadata = {
          package_name: this.sfdxPackage,
          package_version_number: this.versionNumber,
          sourceVersion: this.commitId,
          repository_url:this.repositoryURL,
          package_type:"source",
          branch:this.branch
        };

        //Convert to MDAPI
        let createSourcePackageImpl = new CreateSourcePackageImpl(
          null,
          this.sfdxPackage,
          packageMetadata,
          true,
          new ConsoleLogger(),
        );
        packageMetadata = await createSourcePackageImpl.exec();

        console.log(COLOR_SUCCESS(`Created source package ${packageMetadata.package_name}`));
       
        return packageMetadata;
  }

  protected getConfigFilePath(): string {
    return null;
  }
  
}
