import ManifestHelpers from "../sfdxutils/ManifestHelpers";
import simplegit, { SimpleGit } from "simple-git/promise";
import { stringify } from "querystring";

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

        let options = {
            from: `${this.revFrom}`,
            to: this.revTo,
            file: `${packageDescriptor["path"]}*`
        };
        const gitLogResult = await git.log(options);

        let changelog: Changelog = {
            workItems: {},
            package: {
                name: "",
                from: "",
                to: "",
                commits: []
            }
        };
        for (let commit of gitLogResult.all) {
            changelog["package"].name = this.sfdx_package;
            changelog["package"].from = this.revFrom;
            changelog["package"].to = this.revTo;
            changelog["package"].commits.push(
                {
                    date: commit.date,
                    commitId: commit.hash,
                    elapsedDays: "",
                    message: commit.message,
                    body: commit.body
                }
            );
        }

        // Loop over changelog commits and find work items
        let workItemFilter = RegExp(this.workItemFilter, 'gi');
        for (let commit of changelog["package"].commits) {
            let workItems = commit["body"].match(workItemFilter) || commit["message"].match(workItemFilter);
            if (workItems) {
                for (let item of workItems) {
                    if (changelog["workItems"][item] == null) {
                        changelog["workItems"][item] = new Set<string>();
                        changelog["workItems"][item].add(commit["commitId"]);
                    } else {
                        changelog["workItems"][item].add(commit["commitId"]);
                    }
                }
            }
        }

        // Convert back to array for JSON stringify
        // for (let key in changelog["workItems"]) {
        //     changelog["workItems"][key] = Array.from(changelog["workItems"][key]);
        // }
        return changelog;
    }


}



interface Changelog {
    workItems: any,
    package: {
            name: string,
            from: string,
            to: string,
            commits: {
                    date: string,
                    commitId: string,
                    elapsedDays: string,
                    message: string,
                    body: string
            }[]
    }
}
