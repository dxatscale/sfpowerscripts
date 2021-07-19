import { Changelog, Commit } from "@dxatscale/sfpowerscripts.core/lib/changelog/interfaces/GenericChangelogInterfaces";

export interface ReleaseChangelog {
    releases: Release[]
    orgs?: org[]
}

export interface org {
    /**
     * Name of the org
     */
    name: string;

    /**
     * History of releases to the org
     */
    releases: ReleaseId[];

    /**
     * Latest release deployed to org
     */
    latestRelease: ReleaseId;

    /**
     * Number of consecutive deployments of the latest release to the org
     */
    retryCount: number;
}

export interface ReleaseId {
    names: string[],
    buildNumber: number,
    hashId: string
}

export interface Release extends ReleaseId{
    workItems: any,
    artifacts: Artifact[]
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
