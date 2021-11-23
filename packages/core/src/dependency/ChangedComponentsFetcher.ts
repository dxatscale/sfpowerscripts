import Git from "../git/Git";
import IgnoreFiles from "../ignore/IgnoreFiles";
import ProjectConfig from "../project/ProjectConfig";
import MetadataFiles from "../metadata/MetadataFiles";
import Component from "./Component";
import * as fs from "fs-extra";
import path = require("path");

export default class ChangedComponentsFetcher {

  constructor(private baseBranch: string) {}

  async fetch(): Promise<Component[]> {
    const components: Component[] = [];

    let git: Git = new Git();

    let projectConfig = ProjectConfig.getSFDXPackageManifest(null);

    let diff: string[] = await git.diff([
      this.baseBranch,
      `HEAD`,
      `--no-renames`,
      `--name-only`
    ]);

    // Filter diff to package directories
    diff = diff.filter((filepath) =>
      projectConfig.packageDirectories.find((pkg) =>
        // TODO: make comparison more robust
          filepath.includes(pkg.path)
      )
    );

    // Apply root forceignore to the diff
    let ignoreFiles: IgnoreFiles = new IgnoreFiles(
      fs.readFileSync(".forceignore", "utf8")
    );
    diff = ignoreFiles.filter(diff);

    let componentSuccesses = this.getComponentSuccessesFromReports();

    if (diff.length > 0) {
      for (const filepath of diff) {
        const fullApiName = MetadataFiles.getFullApiName(filepath);

        // find package that file belongs to
        const indexOfPackage = projectConfig.packageDirectories.findIndex(pkg =>
          filepath.includes(pkg.path)
        );

        const componentSuccess = componentSuccesses
          .find(component =>
            component.fullName === fullApiName && component.id
          );

        if (componentSuccess) {
          const component: Component = {
            id: componentSuccess.id,
            fullName: componentSuccess.fullName,
            type: componentSuccess.componentType,
            file: filepath,
            package: projectConfig.packageDirectories[indexOfPackage].package,
            indexOfPackage: indexOfPackage
          }

          components.push(component);
        } else {
          console.log(`Unable to ID ${fullApiName}`);
          // Ignore file if it's not an identifiable component
          continue;
        }
      }
    }

    return components;
  }

  /**
   * Aggregates component successes from MDAPI deploy reports
   */
  private getComponentSuccessesFromReports(): any[] {
    let componentSuccesses: any[] = [];

    const reportsDir: string = ".sfpowerscripts/mdapiDeployReports";
    let reports = fs.readdirSync(reportsDir);
    reports.forEach((report) => {
      let data = JSON.parse(
        fs.readFileSync(path.join(reportsDir, report), "utf8")
      );
      componentSuccesses = componentSuccesses.concat(data.result.details.componentSuccesses);
    });
    return componentSuccesses;
  }
}