import SFPLogger, {
    COLOR_ERROR,
    COLOR_HEADER,
    COLOR_KEY_MESSAGE,
    COLOR_SUCCESS,
    Logger,
    LoggerLevel,
} from '@dxatscale/sfp-logger';

import { Duration } from '@salesforce/kit';
import DeploymentExecutor, { DeploySourceResult } from './DeploymentExecutor';
import {
    ComponentSet,
    DeployMessage,
    DeployResult,
    MetadataApiDeployOptions,
    RequestStatus,
} from '@salesforce/source-deploy-retrieve';
import * as fs from 'fs-extra';
import path from 'path';
import SFPOrg from '../org/SFPOrg';
import getFormattedTime from '../utils/GetFormattedTime';
import { TestLevel } from '../apextest/TestOptions';
import { SfProject } from '@salesforce/core';
import { SourceTracking } from '@salesforce/source-tracking';

export default class DeploySourceToOrgImpl implements DeploymentExecutor {
    public constructor(
        private org: SFPOrg,
        private projectDir: string,
        private componentSet: ComponentSet,
        private deploymentOptions: DeploymentOptions,
        private logger?: Logger
    ) {}

    public async exec(): Promise<DeploySourceResult> {
        let deploySourceResult = {} as DeploySourceResult;

        if (this.deploymentOptions.apiVersion) this.componentSet.sourceApiVersion = this.deploymentOptions.apiVersion;

        //Get Deploy ID
        let result = await this.deploy(this.componentSet);

        this.writeResultToReport(result);

        if (this.deploymentOptions.sourceTracking) {
            await this.handleSourceTracking(this.org, this.logger, this.projectDir, result);
        }

        //Handle Responses
        if (result.response.status == RequestStatus.Succeeded) {
            deploySourceResult.message = `Successfully deployed`;
            deploySourceResult.result = result.response.success;
            deploySourceResult.deploy_id = result.response.id;
        } else {
            if (result.response.status == RequestStatus.Canceled) {
                deploySourceResult.message = `The deployment request ${result.response.id} was cancelled by ${result.response.canceledByName}`;
            } else {
                deploySourceResult.message = this.handlErrorMesasge(result);
            }
            deploySourceResult.response = result.response;
            deploySourceResult.result = false;
            deploySourceResult.deploy_id = result.response.id;
        }
        return deploySourceResult;
    }

    private handlErrorMesasge(result: DeployResult): string {
        if (result.response.numberComponentErrors == 0) {
            return 'Unable to fetch report, Check your org for details';
        } else if (result.response.numberComponentErrors > 0) {
            return this.constructComponentErrorMessage(result.response.details.componentFailures, this.logger);
        } else if (result.response.details.runTestResult) {
            return 'Unable to deploy due to unsatisfactory code coverage and/or test failures';
        } else {
            return 'Unable to fetch report, Check your org for details';
        }
    }

    private constructComponentErrorMessage(componentFailures: DeployMessage | DeployMessage[], logger: Logger) {
        let errorMessage = `Unable to deploy due to failure in some components, check log for details`;

        if (componentFailures === null || componentFailures === undefined) return;

        if (componentFailures instanceof Array) {
            //Search for other scenarios and if background Job is being executed, override the error message
            for (let failure of componentFailures) {
                let scenario = classifyErrorScenarios(failure);
                if (scenario == `BackgroundJob`) {
                    errorMessage = `Unable to deploy due to an ongoing background job from a previous package`;
                    break;
                }
            }
        } else {
            let failure = componentFailures;
            let scenario = classifyErrorScenarios(failure);
            if (scenario == `BackgroundJob`) {
                errorMessage = `Unable to deploy due to an ongoing background job from a previous package`;
            }
        }

        function classifyErrorScenarios(failure: DeployMessage) {
            let scenario = `Component Error`;
            //Override if background job is being executed
            if (failure.problem.includes(`background job is being executed`)) {
                scenario = `BackgroundJob`;
            }
            return scenario;
        }
        return errorMessage;
    }

    private writeResultToReport(result: DeployResult) {
        let deploymentReports = `.sfpowerscripts/mdapiDeployReports`;
        fs.mkdirpSync(deploymentReports);
        fs.writeFileSync(
            path.join(deploymentReports, `${result.response.id}.json`),
            JSON.stringify(this.formatResultAsJSON(result))
        );
    }

    private async buildDeploymentOptions(org: SFPOrg): Promise<MetadataApiDeployOptions> {
        let metdataDeployOptions: MetadataApiDeployOptions = {
            usernameOrConnection: org.getConnection(),
            apiOptions: {},
        };

        if (this.deploymentOptions.apiVersion) metdataDeployOptions.apiVersion = this.deploymentOptions.apiVersion;

        if (this.deploymentOptions.testLevel == TestLevel.RunLocalTests) {
            metdataDeployOptions.apiOptions.testLevel = TestLevel.RunLocalTests;
        } else if (this.deploymentOptions.testLevel == TestLevel.RunSpecifiedTests) {
            metdataDeployOptions.apiOptions.testLevel = TestLevel.RunSpecifiedTests;
            metdataDeployOptions.apiOptions.runTests = this.deploymentOptions.specifiedTests.split(`,`);
        } else {
            metdataDeployOptions.apiOptions.testLevel = TestLevel.RunNoTests;
        }

        if (this.deploymentOptions.ignoreWarnings) {
            metdataDeployOptions.apiOptions.ignoreWarnings = true;
        }

        metdataDeployOptions.apiOptions.rollbackOnError = this.deploymentOptions.rollBackOnError;

        return metdataDeployOptions;
    }

    private async deploy(componentSet: ComponentSet) {
        let deploymentOptions = await this.buildDeploymentOptions(this.org);
        const deploy = await componentSet.deploy(deploymentOptions);

        let startTime = Date.now();
        SFPLogger.log(`Deploying to ${this.org.getUsername()} with id:${deploy.id}`, LoggerLevel.INFO, this.logger);
        // Attach a listener to check the deploy status on each poll
        deploy.onUpdate((response) => {
            const { status, numberComponentsDeployed, numberComponentsTotal } = response;
            const progress = `${numberComponentsDeployed}/${numberComponentsTotal}`;
            const message = `Status: ${COLOR_KEY_MESSAGE(status)} Progress: ${COLOR_KEY_MESSAGE(progress)}`;
            SFPLogger.log(message, LoggerLevel.INFO, this.logger);
        });

        deploy.onFinish((response) => {
            let deploymentDuration = Date.now() - startTime;
            if (response.response.success) {
                SFPLogger.log(
                    COLOR_SUCCESS(
                        `Succesfully Deployed ${COLOR_HEADER(
                            response.response.numberComponentsDeployed
                        )} components in ${getFormattedTime(deploymentDuration)}`
                    ),
                    LoggerLevel.INFO,
                    this.logger
                );
            } else
                SFPLogger.log(
                    COLOR_ERROR(`Failed to deploy after ${getFormattedTime(deploymentDuration)}`),
                    LoggerLevel.INFO,
                    this.logger
                );
        });

        // Wait for polling to finish and get the DeployResult object
        const result = await deploy.pollStatus({ frequency: Duration.seconds(30), timeout: Duration.hours(2) });
        return result;
    }

    //For compatibilty with cli output
    private formatResultAsJSON(result) {
        const response = result?.response ? result.response : {};
        return {
            result: {
                ...response,
                details: {
                    componentSuccesses: response?.details?.componentSuccesses,
                    componentFailures: response?.details?.componentFailures,
                    runTestResult: response?.details?.runTestResult,
                },
            },
        };
    }

    private async handleSourceTracking(org: SFPOrg, logger: Logger, projectDir: string, result: DeployResult) {
        if (result.response.success) {
            try {
                const project = await SfProject.resolve(this.projectDir);
                const tracking = await SourceTracking.create({
                    org: org,
                    project: project,
                });
                await tracking.ensureRemoteTracking();
                tracking.updateTrackingFromDeploy(result);
            } catch (error) {
                SFPLogger.log(`Unable to update source tracking due to \n ${error}`, LoggerLevel.WARN, logger);
            }
        }
    }
}

export class DeploymentOptions {
    ignoreWarnings: boolean;
    waitTime: string;
    checkOnly?: boolean;
    apiVersion?: string;
    testLevel?: TestLevel;
    apexTestSuite?: string;
    specifiedTests?: string;
    sourceTracking?: boolean;
    rollBackOnError?: boolean;
}
