import { flags } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import PackageDiffImpl from '@dxatscale/sfpowerscripts.core/lib/package/PackageDiffImpl';
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import ArtifactGenerator from "@dxatscale/sfpowerscripts.core/lib/generators/ArtifactGenerator";
import { exec } from "shelljs";
import * as fs from "fs-extra";
import ProjectConfig from '@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig';
import CreateDataPackageImpl from '@dxatscale/sfpowerscripts.core/lib/sfpcommands/package/CreateDataPackageImpl';
import { COLOR_SUCCESS, ConsoleLogger } from '@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger';
import PackageCreateCommand from '../../../../PackageCreateCommand';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'create_data_package');

export default class CreateDataPackage extends PackageCreateCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:package:data:create -n mypackage -v <version>`,
    `$ sfdx sfpowerscripts:package:data:create -n <mypackage> -v <version> --diffcheck --gittag`,
    `Output variable:`,
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


  public async execute(){
    try {

      const sfdx_package: string = this.flags.package;
      const version_number: string = this.flags.versionnumber;
      const artifactDirectory: string = this.flags.artifactdir;
      const refname: string = this.flags.refname;
      const branch:string=this.flags.branch;

      let packageDescriptor = ProjectConfig.getSFDXPackageDescriptor(null, sfdx_package);
      if (packageDescriptor.type?.toLowerCase() !== "data") {
        throw new Error("Data packages must have 'type' property of 'data' defined in sfdx-project.json");
      }

      let runBuild: boolean;
      if (this.flags.diffcheck) {
        let packageDiffImpl = new PackageDiffImpl(new ConsoleLogger(),sfdx_package, null);

        runBuild = (await packageDiffImpl.exec()).isToBeBuilt;

        if ( runBuild )
        console.log(`Detected changes to ${sfdx_package} package...proceeding\n`);
        else
        console.log(`No changes detected for ${sfdx_package} package...skipping\n`);

      } else runBuild = true;

      if (runBuild) {
        let commit_id = exec('git log --pretty=format:%H -n 1', {silent:true}).stdout;

        let repository_url: string;
        if (this.flags.repourl == null) {
          repository_url = exec('git config --get remote.origin.url', {silent:true});
          // Remove new line '\n' from end of url
          repository_url = repository_url.slice(0,repository_url.length - 1);
        } else repository_url = this.flags.repourl;




        let packageMetadata:PackageMetadata = {
          package_name: sfdx_package,
          package_version_number: version_number,
          sourceVersion: commit_id,
          repository_url:repository_url,
          branch:branch
        };


        let createDataPackageImpl = new CreateDataPackageImpl(
          null,
          sfdx_package,
          packageMetadata,
          false,
          new ConsoleLogger()
        );
        packageMetadata = await createDataPackageImpl.exec();


        console.log(COLOR_SUCCESS(`Created data package ${packageMetadata.package_name}`));
        this.printPackageDetails(packageMetadata);

        if (this.flags.gittag) {
          exec(`git config --global user.email "sfpowerscripts@dxscale"`);
          exec(`git config --global user.name "sfpowerscripts"`);
          let tagname = `${sfdx_package}_v${version_number}`;

          console.log(`Creating tag ${tagname}`);
          exec(`git tag -a -m "${sfdx_package} Data Package ${version_number}" ${tagname} HEAD`, {silent:false});

          packageMetadata.tag = tagname;
        }

      


       //Generate Artifact
        let artifactFilepath: string = await ArtifactGenerator.generateArtifact(
          sfdx_package,
          process.cwd(),
          artifactDirectory,
          packageMetadata
        );

     


        console.log("\nOutput variables:");
        if (refname != null) {
          fs.writeFileSync('.env', `${refname}_sfpowerscripts_artifact_directory=${artifactFilepath}\n`, {flag:'a'});
          console.log(`${refname}_sfpowerscripts_artifact_directory=${artifactFilepath}`);
          fs.writeFileSync('.env', `${refname}_sfpowerscripts_package_version_number=${version_number}\n`, {flag:'a'});
          console.log(`${refname}_sfpowerscripts_package_version_number=${version_number}`);
        } else {
          fs.writeFileSync('.env', `sfpowerscripts_artifact_directory=${artifactFilepath}\n`, {flag:'a'});
          console.log(`sfpowerscripts_artifact_directory=${artifactFilepath}`);
          fs.writeFileSync('.env', `sfpowerscripts_package_version_number=${version_number}\n`, {flag:'a'});
          console.log(`sfpowerscripts_package_version_number=${version_number}`);
        }
      }
    } catch (err) {
      console.log(err.message);
      // Fail the task when an error occurs
      process.exit(1);
    }
  }
}
