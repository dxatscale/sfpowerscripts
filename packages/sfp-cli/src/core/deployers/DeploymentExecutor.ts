import { MetadataApiDeployStatus } from "@salesforce/source-deploy-retrieve";

export default interface DeploymentExecutor {
    exec(): Promise<DeploySourceResult>;
}

export interface DeploySourceResult {
    deploy_id: string;
    result: boolean;
    message: string;
    response?:MetadataApiDeployStatus
}

export enum DeploymentType {
    SOURCE_PUSH,
    MDAPI_DEPLOY,
}
