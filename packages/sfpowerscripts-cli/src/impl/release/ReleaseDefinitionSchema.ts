export default interface ReleaseDefinitionSchema {
    release: string;
    skipIfAlreadyInstalled: boolean;
    baselineOrg: string;
    artifacts: {
        [p: string]: string;
    };
    packageDependencies: {
        [p: string]: string;
    };
    promotePackagesBeforeDeploymentToOrg: string;
    changelog: {
        repoUrl: string;
        workItemFilter: string;
        workItemUrl: string;
        limit: number;
        showAllArtifacts: boolean;
    };
}
