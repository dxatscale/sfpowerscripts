import SFPLogger, { Logger, LoggerLevel } from "@dxatscale/sfp-logger";
import { Release } from "./ReleaseChangelog";

export default class WorkItemUpdater {
    constructor(private latestRelease: Release, private workItemFilters: string[], private logger?: Logger) {}

    /**
     * Generate work items in latest release
     */
    update(): void {
        for (const workItemFilter of this.workItemFilters) {
            const workItemFilterRegex: RegExp = RegExp(workItemFilter, "gi");
            SFPLogger.log(`Matching...${workItemFilterRegex}`, LoggerLevel.INFO, this.logger);

            for (const artifact of this.latestRelease["artifacts"]) {
                for (const commit of artifact["commits"]) {
                    const commitMessage: string = commit["message"] + "\n" + commit["body"];
                    const workItems: RegExpMatchArray = commitMessage.match(workItemFilterRegex);
                    if (workItems) {
                        for (const item of workItems) {
                            if (this.latestRelease["workItems"][item] == null) {
                                this.latestRelease["workItems"][item] = new Set<string>();
                                this.latestRelease["workItems"][item].add(commit["commitId"].slice(0, 8));
                            } else {
                                this.latestRelease["workItems"][item].add(commit["commitId"].slice(0, 8));
                            }
                        }
                    }
                }
            }
        }

        // Convert each work item Set to Array
        // Enables JSON stringification of work item
        for (const key in this.latestRelease["workItems"]) {
            this.latestRelease.workItems[key] = Array.from(this.latestRelease.workItems[key]);
        }
    }
}
