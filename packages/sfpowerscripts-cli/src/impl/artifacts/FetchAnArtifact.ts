export default interface FetchAnArtifact {
    fetchArtifact(
        packageName: string,
        artifactDirectory: string,
        version: string,
        isToContinueOnMissingArtifact: boolean
    ): void;
}
