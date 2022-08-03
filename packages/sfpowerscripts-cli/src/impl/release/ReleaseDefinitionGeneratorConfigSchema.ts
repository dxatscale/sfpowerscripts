export default interface ReleaseDefinitionGeneratorSchema {
    releaseName?: string;
    changelogBranchRef?:string;
    skipIfAlreadyInstalled: boolean;
    baselineOrg?: string;
    includeArtifacts?:string[]
    excludeArtifacts?:string[];
    excludeArtifactsWithTag?:string[];
    excludePackageDependencies?:string[];
    includePackageDependencies?:string[]
    promotePackagesBeforeDeploymentToOrg?: string;
    changelog?: {
        repoUrl?: string;
        workItemFilter?: string;
        workItemUrl?: string;
        limit?: number;
        showAllArtifacts?: boolean;
    };
}
