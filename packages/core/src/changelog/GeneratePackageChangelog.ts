import ProjectConfig from "../project/ProjectConfig";
import simplegit, { SimpleGit, LogOptions } from "simple-git";
import { Changelog } from "./interfaces/GenericChangelogInterfaces";
import SFPLogger, { LoggerLevel } from "../logger/SFPLogger";

/**
 * A class for generating a changelog between two commits
 * for a single package
 */
export default class GeneratePackageChangelog {
    constructor(
        private readonly sfdx_package: string,
        private readonly revFrom: string,
        private readonly revTo: string,
        private readonly project_directory: string
    ){}

    public async exec(): Promise<Changelog> {
        let git: SimpleGit;
        if (this.project_directory != null) {
            git = simplegit(this.project_directory);
        } else {
            git = simplegit();
        }

        let packageDescriptor;
        try {
          packageDescriptor = ProjectConfig.getSFDXPackageDescriptor(
              this.project_directory,
              this.sfdx_package
          );
        } catch (err) {
          SFPLogger.log(`Unable to find descriptor for package ${this.sfdx_package}`,LoggerLevel.WARN);
          SFPLogger.log(err.message,LoggerLevel.WARN);
        }

        let revFrom: string;
        if (this.revFrom) {
          revFrom = await git.revparse([
            "--short",
            `${this.revFrom}^{}`
          ]);
        }

        let revTo: string = await git.revparse([
          "--short",
          `${this.revTo}^{}`
        ]);

        let options: LogOptions = {
            from: revFrom,
            to: revTo,
            file: packageDescriptor ? `${packageDescriptor["path"]}*` : packageDescriptor
        };
        const gitLogResult = await git.log(options);

        let changelog: Changelog = {
          name: undefined,
          from: undefined,
          to: undefined,
          commits: []
        };

        changelog["name"] = this.sfdx_package;
        changelog["from"] = revFrom;
        changelog["to"] = revTo;

        for (let commit of gitLogResult.all) {
            changelog["commits"].push(
                {
                    commitId: commit.hash.slice(0,8),
                    date: commit.date,
                    author: commit.author_name,
                    message: commit.message,
                    body: commit.body
                }
            );
        }

        return changelog;
    }
}
