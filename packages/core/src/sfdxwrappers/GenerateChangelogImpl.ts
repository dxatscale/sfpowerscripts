import ManifestHelpers from "../sfdxutils/ManifestHelpers";
import simplegit, { SimpleGit, LogOptions } from "simple-git/promise";
import { ListLogSummary } from "simple-git/typings/response";

/**
 * A class for generating a changelog between two commits
 * for a single package
 */
export default class GenerateChangelogImpl {
    constructor(
        private readonly sfdx_package: string,
        private readonly revFrom: string,
        private readonly revTo: string,
        private readonly workItemFilter: string
    ){}

    public async exec(): Promise<Changelog> {
        const git: SimpleGit = simplegit();

        const packageDescriptor = ManifestHelpers.getSFDXPackageDescriptor(
            null,
            this.sfdx_package
        );

        let options: LogOptions = {
            from: this.revFrom,
            to: this.revTo,
            file: `${packageDescriptor["path"]}*`
        };
        const gitLogResult: ListLogSummary = await git.log(options);

        let changelog: Changelog = {
            workItems: {},
            package: {
                name: "",
                from: "",
                to: "",
                commits: []
            }
        };

        changelog["package"].name = this.sfdx_package;
        changelog["package"].from = this.revFrom;
        changelog["package"].to = this.revTo;

        for (let commit of gitLogResult.all) {
            changelog["package"].commits.push(
                {
                    commitId: commit.hash.slice(0,8),
                    date: commit.date,
                    elapsedDays: "",
                    author: commit.author_name,
                    message: commit.message,
                    body: commit.body
                }
            );
        }

        // Loop over changelog commits and find work items
        let workItemFilter: RegExp = RegExp(this.workItemFilter, 'gi');
        for (let commit of changelog["package"].commits) {
            let workItems: RegExpMatchArray = commit["body"].match(workItemFilter) || commit["message"].match(workItemFilter);
            if (workItems) {
                for (let item of workItems) {
                    if (changelog["workItems"][item] == null) {
                        changelog["workItems"][item] = new Set<string>();
                        changelog["workItems"][item].add(commit["commitId"].slice(0,8));
                    } else {
                        changelog["workItems"][item].add(commit["commitId"].slice(0,8));
                    }
                }
            }
        }

        return changelog;
    }


}


export interface Changelog {
    workItems: any,
    package: {
            name: string,
            from: string,
            to: string,
            commits: {
                    commitId: string,
                    date: string,
                    elapsedDays: string,
                    author: string,
                    message: string,
                    body: string
            }[]
    }
}
