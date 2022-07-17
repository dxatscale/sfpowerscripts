import SFPLogger, {
    COLOR_ERROR,
    COLOR_HEADER,
    COLOR_KEY_MESSAGE,
    COLOR_SUCCESS,
    Logger,
    LoggerLevel,
} from '@dxatscale/sfp-logger';
import DeployErrorDisplayer from '../display/DeployErrorDisplayer';
import { Duration } from '@salesforce/kit';
import DeploymentExecutor, { DeploySourceResult } from './DeploymentExecutor';
import {
    CodeCoverageWarnings,
    ComponentSet,
    DeployResult,
    Failures,
    MetadataApiDeployOptions,
    RequestStatus,
} from '@salesforce/source-deploy-retrieve';
import PackageComponentPrinter from '../display/PackageComponentPrinter';
const Table = require('cli-table');
import * as fs from 'fs-extra';
import path from 'path';
import SFPOrg from '../org/SFPOrg';
import getFormattedTime from '../utils/GetFormattedTime';
import { TestLevel } from '../apextest/TestOptions';

export default class DeploySourceToOrgImpl implements DeploymentExecutor {
    public constructor(
        private org: SFPOrg,
        private componentSet: ComponentSet,
        private deploymentOptions: DeploymentOptions,
        private logger?: Logger
    ) {}

    public async exec(): Promise<DeploySourceResult> {
        let deploySourceResult = {} as DeploySourceResult;

        if (this.deploymentOptions.apiVersion) this.componentSet.sourceApiVersion = this.deploymentOptions.apiVersion;

        let components = this.componentSet.getSourceComponents();

        //Print components inside Component Set
        PackageComponentPrinter.printComponentTable(components, this.logger);

        //Display Options
        this.printDeploymentOptions();

        //Get Deploy ID
        let result = await this.deploy(this.componentSet);

        this.writeResultToReport(result);

        //Handle Responses
        if (result.response.success) {
            deploySourceResult.message = `Successfully deployed`;
            deploySourceResult.result = result.response.success;
            deploySourceResult.deploy_id = result.response.id;
        } else {
            if (result.response.status == RequestStatus.Canceled) {
                deploySourceResult.message = `The deployment request ${result.response.id} was cancelled by ${result.response.canceledByName}`;
            } else {
                deploySourceResult.message = await this.displayErrors(result);
            }
            deploySourceResult.result = false;
            deploySourceResult.deploy_id = result.response.id;
        }
        return deploySourceResult;
    }

    private printDeploymentOptions() {
        SFPLogger.log(
            `${COLOR_HEADER(
                `=================================================================================================`
            )}`,
            LoggerLevel.INFO,
            this.logger
        );
        SFPLogger.log(`${COLOR_HEADER(`Deployment Options`)}`, LoggerLevel.INFO, this.logger);
        SFPLogger.log(
            `${COLOR_HEADER(
                `=================================================================================================`
            )}`,
            LoggerLevel.INFO,
            this.logger
        );
        SFPLogger.log(
            `TestLevel: ${COLOR_KEY_MESSAGE(this.deploymentOptions.testLevel)}`,
            LoggerLevel.INFO,
            this.logger
        );
        if (this.deploymentOptions.testLevel == TestLevel.RunSpecifiedTests)
            SFPLogger.log(
                `Tests to be triggered: ${COLOR_KEY_MESSAGE(this.deploymentOptions.specifiedTests)}`,
                LoggerLevel.INFO,
                this.logger
            );

        SFPLogger.log(
            `Ignore Warnings: ${COLOR_KEY_MESSAGE(this.deploymentOptions.ignoreWarnings)}`,
            LoggerLevel.INFO,
            this.logger
        );

        SFPLogger.log(`Roll Back on Error: ${COLOR_KEY_MESSAGE('true')}`, LoggerLevel.INFO, this.logger);

        SFPLogger.log(
            `API Version: ${COLOR_KEY_MESSAGE(this.deploymentOptions.apiVersion)}`,
            LoggerLevel.INFO,
            this.logger
        );
        SFPLogger.log(
            `${COLOR_HEADER(
                `=================================================================================================`
            )}`,
            LoggerLevel.INFO,
            this.logger
        );
    }

    private writeResultToReport(result: DeployResult) {
        let deploymentReports = `.sfpowerscripts/mdapiDeployReports`;
        fs.mkdirpSync(deploymentReports);
        fs.writeFileSync(
            path.join(deploymentReports, `${result.response.id}.json`),
            JSON.stringify(this.formatResultAsJSON(result))
        );
    }

    private async displayErrors(result: DeployResult): Promise<string> {
        SFPLogger.log(`Gathering Final Deployment Status`, null, this.logger);

        if (result.response.numberComponentErrors > 0) {
            DeployErrorDisplayer.printMetadataFailedToDeploy(result.response.details.componentFailures, this.logger);
            return result.response.errorMessage;
        } else if (result.response.details.runTestResult) {
            if (result.response.details.runTestResult.codeCoverageWarnings) {
                this.displayCodeCoverageWarnings(result.response.details.runTestResult.codeCoverageWarnings);
            }

            if (result.response.details.runTestResult.failures) {
                this.displayTestFailures(result.response.details.runTestResult.failures);
            }
            return 'Unable to deploy due to unsatisfactory code coverage and/or test failures';
        } else {
            return 'Unable to fetch report';
        }
    }

    private displayCodeCoverageWarnings(codeCoverageWarnings: CodeCoverageWarnings | CodeCoverageWarnings[]) {
        let table = new Table({
            head: ['Name', 'Message'],
        });

        if (Array.isArray(codeCoverageWarnings)) {
            codeCoverageWarnings.forEach((coverageWarningElement) => {
                table.push([coverageWarningElement['name'], coverageWarningElement.message]);
            });
        } else {
            table.push([codeCoverageWarnings['name'], codeCoverageWarnings.message]);
        }

        SFPLogger.log(
            'Unable to deploy due to unsatisfactory code coverage, Check the following classes:',
            LoggerLevel.WARN,
            this.logger
        );
        SFPLogger.log(table.toString(), LoggerLevel.WARN, this.logger);
    }

    private displayTestFailures(testFailures: Failures | Failures[]) {
        let table = new Table({
            head: ['Test Name', 'Method Name', 'Message'],
        });

        if (Array.isArray(testFailures)) {
            testFailures.forEach((elem) => {
                table.push([elem.name, elem.methodName, elem.message]);
            });
        } else {
            table.push([testFailures.name, testFailures.methodName, testFailures.message]);
        }
        SFPLogger.log('Unable to deploy due to test failures:', LoggerLevel.WARN, this.logger);
        SFPLogger.log(table.toString(), LoggerLevel.WARN, this.logger);
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
        //dont change this and is not part of the input
        metdataDeployOptions.apiOptions.rollbackOnError = true;

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
}

export class DeploymentOptions {
    ignoreWarnings: boolean;
    waitTime: string;
    checkOnly?: boolean;
    apiVersion?: string;
    testLevel?: TestLevel;
    apexTestSuite?: string;
    specifiedTests?: string;
}
