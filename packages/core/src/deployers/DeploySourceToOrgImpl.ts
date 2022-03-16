import SFPLogger, {
    COLOR_ERROR,
    COLOR_HEADER,
    COLOR_KEY_MESSAGE,
    COLOR_SUCCESS,
    Logger,
    LoggerLevel,
} from '../logger/SFPLogger';
import PackageEmptyChecker from '../package/PackageEmptyChecker';
import DeployErrorDisplayer from '../display/DeployErrorDisplayer';
import { Duration } from '@salesforce/kit';
import DeploymentExecutor, { DeploySourceResult } from './DeploymentExecutor';
import {
    CodeCoverageWarnings,
    ComponentSet,
    DeployResult,
    Failures,
    MetadataApiDeployOptions,
} from '@salesforce/source-deploy-retrieve';
import PackageComponentPrinter from '../display/PackageComponentPrinter';
import ApexTestSuite from '../apextest/ApexTestSuite';
const Table = require('cli-table');
import * as fs from 'fs-extra';
import path from 'path';
import SFPOrg from '../org/SFPOrg';
import getFormattedTime from '../utils/GetFormattedTime';

export default class DeploySourceToOrgImpl implements DeploymentExecutor {
    public constructor(
        private org: SFPOrg,
        private project_directory: string,
        private source_directory: string,
        private deployment_options: any,
        private isToBreakBuildIfEmpty: boolean,
        private packageLogger?: Logger
    ) {}

    public async exec(): Promise<DeploySourceResult> {
        let deploySourceResult = {} as DeploySourceResult;

        //Check empty conditions
        let status = PackageEmptyChecker.isToBreakBuildForEmptyDirectory(
            this.project_directory,
            this.source_directory,
            this.isToBreakBuildIfEmpty
        );
        if (status.result == 'break') {
            deploySourceResult.result = false;
            deploySourceResult.message = status.message;
            return deploySourceResult;
        } else if (status.result == 'skip') {
            deploySourceResult.result = true;
            deploySourceResult.message = 'skip:' + status.message;
            return deploySourceResult;
        } else {
            //Create path
            let sourceDirPath: string = path.resolve(this.source_directory);
            if (this.project_directory) sourceDirPath = path.resolve(this.project_directory, this.source_directory);

            //Create component set from source directory
            let componentSet = ComponentSet.fromSource(sourceDirPath);
            if (this.deployment_options['apiVersion'])
                componentSet.sourceApiVersion = this.deployment_options['apiVersion'];

            let components = componentSet.getSourceComponents();

            //Print components inside Component Set
            PackageComponentPrinter.printComponentTable(components, this.packageLogger);

            //Get Deploy ID
            let result = await this.deploy(sourceDirPath, componentSet);

            this.writeResultToReport(result);

            //Handle Responses
            if (result.response.success) {
                deploySourceResult.message = `Successfully deployed`;
                deploySourceResult.result = result.response.success;
                deploySourceResult.deploy_id = result.response.id;
            } else {
                deploySourceResult.message = await this.displayErrors(result);
                deploySourceResult.result = false;
                deploySourceResult.deploy_id = result.response.id;
            }
            return deploySourceResult;
        }
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
        SFPLogger.log(`Gathering Final Deployment Status`, null, this.packageLogger);

        if (result.response.numberComponentErrors > 0) {
            DeployErrorDisplayer.printMetadataFailedToDeploy(
                result.response.details.componentFailures,
                this.packageLogger
            );
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
            this.packageLogger
        );
        SFPLogger.log(table.toString(), LoggerLevel.WARN, this.packageLogger);
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
        SFPLogger.log('Unable to deploy due to test failures:', LoggerLevel.WARN, this.packageLogger);
        SFPLogger.log(table.toString(), LoggerLevel.WARN, this.packageLogger);
    }

    private async buildDeploymentOptions(sourceDir: string, org: SFPOrg): Promise<MetadataApiDeployOptions> {
        let metdataDeployOptions: MetadataApiDeployOptions = {
            usernameOrConnection: org.getConnection(),
            apiOptions: {},
        };

        if (this.deployment_options['apiVersion'])
            metdataDeployOptions.apiVersion = this.deployment_options['apiVersion'];

        if (this.deployment_options['testlevel'] == 'RunApexTestSuite') {
            metdataDeployOptions.apiOptions.testLevel = `RunSpecifiedTests`;
            let apexTestSuite = new ApexTestSuite(sourceDir, this.deployment_options['apextestsuite']);
            metdataDeployOptions.apiOptions.runTests = await apexTestSuite.getConstituentClasses();
        } else if (this.deployment_options['testlevel'] == 'RunSpecifiedTests') {
            metdataDeployOptions.apiOptions.testLevel = `RunSpecifiedTests`;
            metdataDeployOptions.apiOptions.runTests = this.deployment_options['specified_tests'].split(`,`);
        } else {
            metdataDeployOptions.apiOptions.testLevel = this.deployment_options['testlevel'];
        }

        if (this.deployment_options['ignore_warnings']) {
            metdataDeployOptions.apiOptions.ignoreWarnings = true;
        }
        if (this.deployment_options['ignore_errors']) {
            metdataDeployOptions.apiOptions.rollbackOnError = false;
        }
        return metdataDeployOptions;
    }

    private async deploy(backingSourceDir: string, componentSet: ComponentSet) {
        let deploymentOptions = await this.buildDeploymentOptions(backingSourceDir, this.org);
        const deploy = await componentSet.deploy(deploymentOptions);

        let startTime = Date.now();
        SFPLogger.log(
            `Deploying to ${this.org.getUsername()} with id:${deploy.id}`,
            LoggerLevel.INFO,
            this.packageLogger
        );
        // Attach a listener to check the deploy status on each poll
        deploy.onUpdate((response) => {
            const { status, numberComponentsDeployed, numberComponentsTotal } = response;
            const progress = `${numberComponentsDeployed}/${numberComponentsTotal}`;
            const message = `Status: ${COLOR_KEY_MESSAGE(status)} Progress: ${COLOR_KEY_MESSAGE(progress)}`;
            SFPLogger.log(message, LoggerLevel.INFO, this.packageLogger);
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
                    this.packageLogger
                );
            } else
                SFPLogger.log(
                    COLOR_ERROR(`Failed to deploy after ${getFormattedTime(deploymentDuration)}`),
                    LoggerLevel.INFO,
                    this.packageLogger
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
