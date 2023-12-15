export default interface ReleaseDefinitionSchema {
    release: string;
    skipIfAlreadyInstalled: boolean;
    skipArtifactUpdate:boolean;
    baselineOrg?: string;
    artifacts: {
        [p: string]: string;
    };
    packageDependencies?: {
        [p: string]: string;
    };
    promotePackagesBeforeDeploymentToOrg?: string;
    changelog?: {
        repoUrl?: string;
        workItemFilter?:string;
        workItemFilters?: string[];
        workItemUrl?: string;
        limit?: number;
        showAllArtifacts?: boolean;
    };
}
