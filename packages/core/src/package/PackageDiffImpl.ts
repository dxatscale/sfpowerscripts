import ignore from "ignore";
const fs = require("fs");
const path = require("path");
import simplegit, { SimpleGit } from "simple-git/promise";
import SFPLogger from "../utils/SFPLogger";
import ManifestHelpers from "../manifest/ManifestHelpers";

export default class PackageDiffImpl {
  public constructor(
    private sfdx_package: string,
    private project_directory: string,
    private config_file_path?: string,
    private override?: boolean,
    private package_type?: string
  ) {}

  public async exec(): Promise<boolean> {
    let git: SimpleGit;

    let config_file_path: string = this.config_file_path;

    let project_config_path: string;
    if (this.project_directory != null) {
      project_config_path = path.join(
        this.project_directory,
        "sfdx-project.json"
      );
      git = simplegit(this.project_directory);
      SFPLogger.log(`Project directory being analysed ${this.project_directory}`);
    } else {
      project_config_path = "sfdx-project.json";
      git = simplegit();
      SFPLogger.log(`Project directory being analysed ${process.cwd()}`);
    }

    let project_json = JSON.parse(fs.readFileSync(project_config_path));

    for (let dir of project_json["packageDirectories"]) {
      if (this.sfdx_package === dir.package) {
        SFPLogger.log(
          `Checking last known tags for ${this.sfdx_package} to determine whether package is to be built...`
        );

        let tag: string;
        if ( this.override != null ) {
          tag = this.getLatestTagFromFile();
        } else {
          tag = await this.getLatestTag(git, this.sfdx_package);
        }

        if (tag) {
          SFPLogger.log(`\nUtilizing tag ${tag} for ${this.sfdx_package}`);

          // Get the list of modified files between the tag and HEAD refs
          let gitDiffResult: string = await git.diff([
            `${tag}`,
            `HEAD`,
            `--name-only`,
          ]);
          let modified_files: string[] = gitDiffResult.split("\n");
          modified_files.pop(); // Remove last empty element

          // Apply forceignore if not data package type
          if (this.package_type != "data") {
            let forceignorePath: string;
            if (this.project_directory != null)
              forceignorePath = path.join(this.project_directory, ".forceignore");
            else forceignorePath = ".forceignore";

            // Filter the list of modified files with .forceignore
            modified_files = ignore()
              .add(fs.readFileSync(forceignorePath).toString())
              .filter(modified_files);
          }

          let packageType: string = ManifestHelpers.getPackageType(project_json, this.sfdx_package);

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

  private async getLatestTag(git: any, sfdx_package: string): Promise<string> {
    let gitTagResult: string = await git.tag([
      `-l`,
      `${sfdx_package}_v*`,
      `--sort=version:refname`,
      `--merged`
    ]);
    let tags: string[] = gitTagResult.split("\n");
    tags.pop(); // Remove last empty element

    SFPLogger.log("Analysing tags:");
    if (tags.length > 10) {
      SFPLogger.log(tags.slice(-10).toString().replace(/,/g, "\n"));
    } else {
      SFPLogger.log(tags.toString().replace(/,/g, "\n"));
    }

    let latestTag = tags.pop(); // Select latest tag
    return latestTag;
  }

  private async isPackageVersionChanged(
    git: any,
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

  private getLatestTagFromFile(): string {
    if (fs.existsSync(`packageDiffTags.json`)) {
      let latestTags = JSON.parse(fs.readFileSync(`packageDiffTags.json`, 'utf8'));
      if (latestTags[this.sfdx_package] != null) {
        return latestTags[this.sfdx_package];
      } else {
        throw new Error(`Tag missing for ${this.sfdx_package} in packageDiffTags.json`);
      }
    } else {
      throw new Error(`packageDiffTags.json does not exist`);
    }
  }
}
