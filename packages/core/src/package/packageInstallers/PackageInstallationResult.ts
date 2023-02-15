export type PackageInstallationResult = {
    result: PackageInstallationStatus;
    deploy_id?: string;
    message?: string;
    elapsedTime?:number;
    isPreScriptExecutionSuceeded?: boolean;
    isPostScriptExecutionSuceeeded?:boolean;
    numberOfComponentsDeployed?:number;
};

export enum PackageInstallationStatus {
    Skipped,
    Succeeded,
    Failed,
}
