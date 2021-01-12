const fs = require("fs");
const path = require("path");
import Git from "../utils/Git";
import IgnoreFiles from "../utils/IgnoreFiles";
import SFPLogger from "../utils/SFPLogger";
import ProjectConfig from "../project/ProjectConfig";

export default class PackageDiffImpl {
  public constructor(
    private sfdx_package: string,
    private project_directory: string,
    private config_file_path?: string,
    private packagesToCommits?: {[p: string]: string},
  ) {}

  public async exec(): Promise<boolean> {
    let git: Git = new Git(this.project_directory);

    let config_file_path: string = this.config_file_path;

    let project_config_path: string;
    if (this.project_directory != null) {
      project_config_path = path.join(
        this.project_directory,
        "sfdx-project.json"
      );
      SFPLogger.log(`Project directory being analysed ${this.project_directory}`);
    } else {
      project_config_path = "sfdx-project.json";
      SFPLogger.log(`Project directory being analysed ${process.cwd()}`);
    }

    let project_json = JSON.parse(fs.readFileSync(project_config_path));

    for (let dir of project_json["packageDirectories"]) {
      if (this.sfdx_package === dir.package) {
        SFPLogger.log(
          `Checking last known tags for ${this.sfdx_package} to determine whether package is to be built...`
        );

        let tag: string;
        if ( this.packagesToCommits != null ) {
          tag = this.getLatestCommitFromMap(this.sfdx_package, this.packagesToCommits);
        } else {
          tag = await this.getLatestTagFromGit(git, this.sfdx_package);
        }

        if (tag) {
          SFPLogger.log(`\nUtilizing tag ${tag} for ${this.sfdx_package}`);

          // Get the list of modified files between the tag and HEAD refs
          let modified_files: string[] = await git.diff([
            `${tag}`,
            `HEAD`,
            `--no-renames`,
            `--name-only`
          ]);
          let packageType: string = ProjectConfig.getPackageType(project_json, this.sfdx_package);
          // Apply forceignore if not data package type
          if (packageType !== "Data") {
            let forceignorePath: string;
            if (this.project_directory != null)
              forceignorePath = path.join(this.project_directory, ".forceignore");
            else forceignorePath = ".forceignore";

            let ignoreFiles: IgnoreFiles = new IgnoreFiles(
              fs.readFileSync(forceignorePath).toString()
            );

            // Filter the list of modified files with .forceignore
            modified_files = ignoreFiles.filter(modified_files);
          }


          if (config_file_path != null && packageType === "Unlocked")
            SFPLogger.log(`Checking for changes to ${config_file_path}`);

          SFPLogger.log(`Checking for changes in source directory '${dir.path}'`);
          // From the filtered list of modified files, check whether the package has been modified
          for (let filename of modified_files) {
            if (config_file_path != null && packageType === "Unlocked") {
              if (
                  filename.includes(`${dir.path}`) ||
                  filename === config_file_path
              ) {
                  SFPLogger.log(`Found change in ${filename}`);
                  return true;
              }
            } else {
              if (filename.includes(`${dir.path}`)) {
                SFPLogger.log(`Found change in ${filename}`);
                return true;
              }
            }
          }

          SFPLogger.log(`Checking for changes to package version number in sfdx-project.json`);

          return await this.isPackageVersionChanged(
            git,
            tag,
            dir.versionNumber
          );
        } else {
          SFPLogger.log(
            `Tag missing for ${this.sfdx_package}...marking package for build anyways`
          );
          return true;
        }
      }
    }
    throw new Error(
      `Unable to find ${this.sfdx_package} in package directories`
    );
  }

  private async getLatestTagFromGit(git: Git, sfdx_package: string): Promise<string> {
    let tags: string[] = await git.tag([
      `-l`,
      `${sfdx_package}_v*`,
      `--sort=version:refname`,
      `--merged`
    ]);

    SFPLogger.log("Analysing tags:");
    if (tags.length > 10) {
      SFPLogger.log(tags.slice(-10).toString().replace(/,/g, "\n"));
    } else {
      SFPLogger.log(tags.toString().replace(/,/g, "\n"));
    }

    return tags.pop();
  }

  private async isPackageVersionChanged(
    git: Git,
    latestTag: string,
    packageVersionHead: string
  ): Promise<boolean> {
    let project_config: string = await git.show([
      `${latestTag}:sfdx-project.json`,
    ]);
    let project_json = JSON.parse(project_config);

    let packageVersionLatestTag: string;
    for (let dir of project_json["packageDirectories"]) {
      if (this.sfdx_package === dir.package) {
        packageVersionLatestTag = dir.versionNumber;
      }
    }

    if ( packageVersionHead != packageVersionLatestTag) {
        SFPLogger.log(
            `Found change in package version number ${packageVersionLatestTag} -> ${packageVersionHead}`
        );
        return true;
    } else {
        return false;
    }
  }

  private getLatestCommitFromMap(
    sfdx_package: string,
    packagesToCommits: {[p: string]: string}
  ): string {
    if (packagesToCommits[sfdx_package] != null) {
      return packagesToCommits[sfdx_package];
    } else {
      return null;
    }
  }
}
