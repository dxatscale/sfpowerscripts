export default interface ReleaseDefinition {
    release: string;
    releaseConfigName?:string;
    metadata?: any;
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
