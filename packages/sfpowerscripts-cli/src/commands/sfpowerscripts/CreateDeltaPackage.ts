import { flags } from "@salesforce/command";
import { Messages } from "@salesforce/core";
import CreateDeltaPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/CreateDeltaPackageImpl";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import ArtifactGenerator from "@dxatscale/sfpowerscripts.core/lib/generators/ArtifactGenerator";
import { isNullOrUndefined } from "util";
import { exec } from "shelljs";
import CreateSourcePackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/CreateSourcePackageImpl";
import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';
import simplegit, { SimpleGit } from "simple-git/promise";
const fs = require("fs-extra");

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages(
  "@dxatscale/sfpowerscripts",
  "create_delta_package"
);

export default class CreateDeltaPackage extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:CreateDeltaPackage -n <packagename> -r <61635fb> -t <3cf01b9> -v <version> -b\n`,
    `Output variable:`,
    `sfpowerscripts_delta_package_path`,
    `<refname>_sfpowerscripts_delta_package_path`,
    `sfpowerscripts_artifact_metadata_directory`,
    `<refname>_sfpowerscripts_artifact_metadata_directory`,
    `sfpowerscripts_artifact_directory`,
    `<refname>_sfpowerscripts_artifact_directory`,
  ];

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  protected static flagsConfig = {
    package: flags.string({
      required: false,
      char: "n",
      description: messages.getMessage("packageNameFlagDescription"),
    }),
    revisionfrom: flags.string({
      required: true,
      char: "r",
      description: messages.getMessage("revisionFromFlagDescription"),
    }),
    revisionto: flags.string({
      char: "t",
      description: messages.getMessage("revisionToFlagDescription"),
      default: "HEAD",
    }),
    versionname: flags.string({
      required: true,
      char: "v",
      description: messages.getMessage("versionNameFlagDescription"),
    }),
    repourl: flags.string({
      description: messages.getMessage("repoUrlFlagDescription"),
    }),
    artifactdir: flags.directory({
      description: messages.getMessage("artifactDirectoryFlagDescription"),
      default: "artifacts",
    }),
    generatedestructivemanifest: flags.boolean({
      char: "x",
      description: messages.getMessage(
        "generateDestructiveManifestFlagDescription"
      ),
    }),
    refname: flags.string({
      description: messages.getMessage("refNameFlagDescription"),
    }),
  };


  public async execute(){
    try {

      const sfdx_package = this.flags.package;
      const artifactDirectory = this.flags.artifactdir;
      const versionName: string = this.flags.versionname;
      const refname: string = this.flags.refname;

      let git: SimpleGit = simplegit();

      let revisionFrom: string = await git.revparse([
        "--short",
        `${this.flags.revisionfrom}^{}`
      ]);
      let revision_to: string = await git.revparse([
        "--short",
        `${this.flags.revisionto}^{}`
      ]);

      console.log(exec(`git rev-parse --short ${this.flags.revisionto}^{}`,{silent:true}));
      let options: any = {};

      let repository_url: string;
      if (isNullOrUndefined(this.flags.repourl)) {
        repository_url = exec("git config --get remote.origin.url", {
          silent: true,
        });
        // Remove new line '\n' from end of url
        repository_url = repository_url.slice(0, repository_url.length - 1);
      } else repository_url = this.flags.repourl;



      const generate_destructivemanifest = this.flags
        .generatedestructivemanifest;


      let createDeltaPackageImp = new CreateDeltaPackageImpl(
        null,
        sfdx_package,
        revisionFrom,
        revision_to,
        generate_destructivemanifest,
        options
      );

      let deltaPackage = await createDeltaPackageImp.exec();
      let deltaPackageFilePath = deltaPackage.deltaDirectory;

      if (!isNullOrUndefined(refname)) {
        fs.writeFileSync(
          ".env",
          `${refname}_sfpowerscripts_delta_package_path=${deltaPackageFilePath}\n`,
          { flag: "a" }
        );
      } else {
        fs.writeFileSync(
          ".env",
          `sfpowerscripts_delta_package_path=${deltaPackageFilePath}\n`,
          { flag: "a" }
        );
      }

      let packageMetadata: PackageMetadata = {
        package_name: sfdx_package,
        package_version_number: versionName,
        sourceVersionFrom: revisionFrom,
        sourceVersionTo: revision_to,
        repository_url: repository_url,
      };

     

      //Delta Package.. Trigger All Tests
      packageMetadata.isTriggerAllTests =true

      let createSourcePackageImpl = new CreateSourcePackageImpl(
        deltaPackage.deltaDirectory,
        sfdx_package,
        deltaPackage.destructiveChangesPath,
        packageMetadata
      );
      packageMetadata = await createSourcePackageImpl.exec();

      console.log(
        JSON.stringify(packageMetadata, function (key, value) {
          if(key=="payload" || key == "destructiveChanges")
          return undefined;
        else
           return value;
        })
      );




      //Generate Artifact
        //Switch to delta
      packageMetadata.package_type="delta";
      let artifact= await ArtifactGenerator.generateArtifact(sfdx_package,process.cwd(),artifactDirectory,packageMetadata);


      console.log("\nOutput variables:");
      if (!isNullOrUndefined(refname)) {
        fs.writeFileSync('.env', `${refname}_sfpowerscripts_artifact_directory=${artifact.artifactDirectory}\n`, {flag:'a'});
        console.log(`${refname}_sfpowerscripts_artifact_directory=${artifact.artifactDirectory}`);
      } else {
        fs.writeFileSync('.env', `sfpowerscripts_artifact_directory=${artifact.artifactSourceDirectory}\n`, {flag:'a'});
        console.log(`sfpowerscripts_artifact_directory=${artifact.artifactSourceDirectory}`);
      }




    } catch (err) {
      console.log(err);
      // Fail the task when an error occurs
      process.exit(1);
    }
  }
}
