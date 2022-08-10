export default interface ReleaseDefinitionGeneratorSchema {
    skipIfAlreadyInstalled: boolean;
    baselineOrg?: string;
    includeOnlyArtifacts?:string[]
    excludeArtifacts?:string[];
    excludeArtifactsWithTag?:string[];
    excludePackageDependencies?:string[];
    includeOnlyPackageDependencies?:string[]
    promotePackagesBeforeDeploymentToOrg?: string;
    changelog?: {
        repoUrl?: string;
        workItemFilters?: string[];
        workItemUrl?: string;
        limit?: number;
        showAllArtifacts?: boolean;
    };
}
