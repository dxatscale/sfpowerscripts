export default interface ReleaseConfig {
    releaseName?: string;
    pool?:string;
    includeOnlyArtifacts?: string[];
    excludeArtifacts?: string[];
    excludeArtifactsWithTag?: string[];
    excludeAllPackageDependencies?:boolean;
    excludePackageDependencies?: string[];
    includeOnlyPackageDependencies?: string[];
    dependencyOn?: string[];
    releasedefinitionProperties?: {
        skipIfAlreadyInstalled: boolean;
        skipArtifactUpdate:boolean;
        baselineOrg?: string;
        promotePackagesBeforeDeploymentToOrg?: string;
        changelog?: {
            repoUrl?: string;
            workItemFilters?: string[];
            workItemUrl?: string;
            limit?: number;
            showAllArtifacts?: boolean;
        };
    };
}
