export default interface DeploymentExecutor {
    exec(): Promise<DeploySourceResult>;
}

export interface DeploySourceResult {
    deploy_id: string;
    result: boolean;
    message: string;
}

export enum DeploymentType {
    SOURCE_PUSH,
    MDAPI_DEPLOY,
    SELECTIVE_MDAPI_DEPLOY
}
