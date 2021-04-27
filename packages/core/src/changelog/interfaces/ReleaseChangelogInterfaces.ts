import IncrementProjectBuildNumberImpl from "../../sfdxwrappers/IncrementProjectBuildNumberImpl";
import { Changelog, Commit } from "./GenericChangelogInterfaces";

export interface ReleaseChangelog {
    releases: Release[]
    orgs?: {name: string, release: Release, retryCount: number}[]


}

export interface Release {
    name: string[],
    buildNumber?: number,
    workItems: any,
    artifacts: Artifact[],
    hashId?: string
}

export interface Artifact extends Changelog {
    /**
     * Name of the artifact
     */
    name: string;

    /**
     * Commit Id from which previous artifact was created
     */
    from: string;

    /**
     * Commit Id from which current artifact was created
     */
    to: string;

    /**
     * Package version number
     */
    version: string;

    /**
     * Latest commit Id in the package changelog
     */
    latestCommitId: string;

    /**
     * Commits between previous artifact's package changelog and current artifact's package changelog
     */
    commits: Commit[];
}
