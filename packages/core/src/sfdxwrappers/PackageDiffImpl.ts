import ignore from "ignore";
const fs = require("fs");
import { isNullOrUndefined } from "util";
const path = require("path");
import git from "simple-git/promise";

export default class PackageDiffImpl {
    public constructor(
        private sfdx_package: string,
        private project_directory: string,
    ) {}

    public async exec(): Promise<boolean> {
        let project_config_path: string;
        if (!isNullOrUndefined(this.project_directory))
            project_config_path = path.join(
                this.project_directory,
                "sfdx-project.json"
            );
        else project_config_path = "sfdx-project.json";

        let project_json = JSON.parse(fs.readFileSync(project_config_path));

        for (let dir of project_json["packageDirectories"]) {
            if (this.sfdx_package == dir.package) {
                console.log(`Checking last known tags for ${this.sfdx_package} to determine whether package is to be built...`);

                let tag = await this.getLatestTag(dir.package);

                if (tag) {
                    console.log(`Found tag ${tag} for ${dir.package}`);

                    // Get the list of modified files between the tag and HEAD refs
                    let gitDiffResult: string = await git().diff([`${tag}`, `HEAD`, `--name-only`]);
                    let modified_files: string[] = gitDiffResult.split("\n");
                    modified_files.pop(); // Remove last empty element

                    let forceignorePath: string;
                    if (!isNullOrUndefined(this.project_directory))
                        forceignorePath = path.join(this.project_directory, ".forceignore");
                    else
                        forceignorePath = ".forceignore";

                    // Filter the list of modified files with .forceignore
                    modified_files = ignore()
                        .add(fs.readFileSync(forceignorePath).toString())
                        .filter(modified_files);

                    // From the filtered list of modified files, check whether the package has been modified
                    for (let filename of modified_files) {
                        if (filename.includes(`${dir.path}`)) {
                            return true;
                        }
                    }
                    return false;
                } else {
                    // Assume package has changed if tag does not exist
                    console.log(`Tag missing for ${this.sfdx_package}...marking package for build anyways`);
                    return true;
                }
            }
        }
        throw new Error(`Unable to find ${this.sfdx_package} in package directories`);
    }

    private async getLatestTag(sfdx_package): Promise<string> {
        let gitTagResult: string = await git().tag([`-l`, `${sfdx_package}_v*`, `--sort=version:refname`]);
        let tags: string[] = gitTagResult.split("\n");
        tags.pop(); // Remove last empty element
        let latestTag = tags.pop(); // Select latest tag
        return latestTag;
    }
}
