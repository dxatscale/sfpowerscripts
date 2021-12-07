import ArtifactGenerator from "@dxatscale/sfpowerscripts.core/lib/generators/ArtifactGenerator";
import { COLOR_HEADER, COLOR_KEY_MESSAGE, ConsoleLogger } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import PackageDiffImpl from "@dxatscale/sfpowerscripts.core/lib/package/PackageDiffImpl";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import { flags } from "@salesforce/command";
import { fs, Messages } from "@salesforce/core";
import { EOL } from "os";
import SfpowerscriptsCommand from "./SfpowerscriptsCommand";
import simplegit from "simple-git";
import GitIdentity from "./impl/git/GitIdentity";


Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'create-package');


export default abstract class PackageCreateCommand extends SfpowerscriptsCommand {

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;
  protected static requiresProject = true;


  protected static flagsConfig = {
    package: flags.string({
      required: true,
      char: "n",
      description: messages.getMessage("packageFlagDescription"),
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
    artifactdir: flags.directory({
      description: messages.getMessage("artifactDirectoryFlagDescription"),
      default: "artifacts",
    }),
    branch:flags.string({
      description:messages.getMessage("branchFlagDescription"),
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
    })
  };


  protected sfdxPackage: string;
  protected versionNumber: string;
  protected artifactDirectory: string;
  protected refname: string;
  protected branch:string;
  protected commitId:string
  protected repositoryURL:string;

    /**
   * Entry point for package installation commands
   *
   */
   async execute(): Promise<any> {
      let isToCreatePackage = await this.preCreate();
      if(isToCreatePackage)
      {
        try
        {
         let packageMetadata = await this.create();
         await this.postCreate(packageMetadata);
        }catch(err)
        {
          console.log(err);
          process.exit(1);
        }


      }
    }




  private async preCreate():Promise<boolean>
  {
     this.sfdxPackage = this.flags.package;
     this.versionNumber = this.flags.versionnumber;
     this.artifactDirectory = this.flags.artifactdir;
     this.refname = this.flags.refname;
     this.branch=this.flags.branch;


     if(this.hubOrg)
       await this.hubOrg.refreshAuth();

    let isToRunBuild;

     if (this.flags.diffcheck) {
       let packageDiffImpl = new PackageDiffImpl(
         new ConsoleLogger(),
         this.sfdxPackage,
         null
       );

       let isToRunBuild = (await packageDiffImpl.exec()).isToBeBuilt;

       if (isToRunBuild)
         console.log(
           `Detected changes to ${this.sfdxPackage} package...proceeding\n`
         );
       else
         console.log(
           `No changes detected for ${this.sfdxPackage} package...skipping\n`
         );
     } else isToRunBuild = true;

     if (isToRunBuild) {
      let git = simplegit();
       if (this.flags.repourl == null) {
         this.repositoryURL = (await git.getConfig("remote.origin.url")).value

       } else this.repositoryURL = this.flags.repourl;
       this.commitId = await git.revparse(['HEAD']);
      }
    return isToRunBuild;

  }


  protected abstract getConfigFilePath():string;

  protected abstract create():Promise<PackageMetadata>;


  private async  postCreate(packageMetadata:PackageMetadata) {
        this.printPackageDetails(packageMetadata);

        if (this.flags.gittag) {
          let git = simplegit();

          await new GitIdentity(git).setUsernameAndEmail();

          let tagname = `${this.sfdxPackage}_v${packageMetadata.package_version_number}`;
          console.log(`Creating tag ${tagname}`);
          await git.addAnnotatedTag(tagname, `${packageMetadata.package_name} sfpowerscripts package ${packageMetadata.package_version_number}`);

          packageMetadata.tag = tagname;
        }

        //Generate Artifact
        let artifactFilepath: string = await ArtifactGenerator.generateArtifact(
          this.sfdxPackage,
          process.cwd(),
          this.artifactDirectory,
          packageMetadata
        );


       this.generateEnvironmentVariables(artifactFilepath, packageMetadata);


  }

  private generateEnvironmentVariables(artifactFilepath: string, packageMetadata: PackageMetadata) {
    let prefix = "sfpowerscripts";
    if (this.refname != null)
      prefix = `${this.refname}_${prefix}`;

    console.log("\nOutput variables:");


    fs.writeFileSync(
      ".env",
      `${prefix}_artifact_directory=${artifactFilepath}\n`,
      { flag: "a" }
    );
    console.log(
      `${prefix}_artifact_directory=${artifactFilepath}`
    );
    fs.writeFileSync(
      ".env",
      `${prefix}_package_version_number=${packageMetadata.package_version_number}\n`,
      { flag: "a" }
    );
    console.log(
      `${prefix}_package_version_number=${packageMetadata.package_version_number}`
    );


    if (packageMetadata.package_version_id) {
      fs.writeFileSync(
        ".env",
        `${prefix}_package_version_id=${packageMetadata.package_version_id}\n`,
        { flag: "a" }
      );
      console.log(
        `${prefix}_package_version_id=${packageMetadata.package_version_id}`
      );
    }
  }

  protected printPackageDetails(packageMetadata: PackageMetadata) {
    console.log(
      COLOR_HEADER(`${EOL}${
        packageMetadata.package_name
      } package created in ${this.getFormattedTime(
        packageMetadata.creation_details.creation_time
      )}`
    ));
    console.log(COLOR_HEADER(`-- Package Details:--`));
    console.log(
      COLOR_HEADER(`-- Package Version Number:        `),
      COLOR_KEY_MESSAGE(packageMetadata.package_version_number)
    );

    if (packageMetadata.package_type !== "data") {
      if (packageMetadata.package_type == "unlocked") {
        console.log(
          COLOR_HEADER(`-- Package Version Id:             `),
          COLOR_KEY_MESSAGE(packageMetadata.package_version_id)
        );
        console.log(
          COLOR_HEADER(`-- Package Test Coverage:          `),
          COLOR_KEY_MESSAGE(packageMetadata.test_coverage)
        );
        console.log(
          COLOR_HEADER(`-- Package Coverage Check Passed:  `),
          COLOR_KEY_MESSAGE(packageMetadata.has_passed_coverage_check)
        );
      }

      console.log(
        COLOR_HEADER(`-- Apex In Package:             `),
        COLOR_KEY_MESSAGE(packageMetadata.isApexFound ? "Yes" : "No")
      );
      console.log(
        COLOR_HEADER(`-- Profiles In Package:         `),
        COLOR_KEY_MESSAGE(packageMetadata.isProfilesFound ? "Yes" : "No")
      );
      console.log(
        COLOR_HEADER(`-- Metadata Count:         `),
        COLOR_KEY_MESSAGE(packageMetadata.metadataCount)
      );
    }
  }


  protected getFormattedTime(milliseconds: number): string {
    let date = new Date(0);
    date.setSeconds(milliseconds / 1000); // specify value for SECONDS here
    let timeString = date.toISOString().substr(11, 8);
    return timeString;
  }

}