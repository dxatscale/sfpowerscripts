import { Changelog, Commit } from "./GenericChangelogInterfaces";

export interface ReleaseChangelog {
    releases: Release[]
}

export interface Release {
    name: string,
    workItems: any
    artifacts: Artifact[]
}

export interface Artifact extends Changelog {
    name: string,
    from: string,
    to: string,
    version: string,
    latestCommitId: string,
    commits: Commit[]
}
