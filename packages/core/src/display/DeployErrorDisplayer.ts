const Table = require('cli-table');
import { CodeCoverageWarnings, DeployMessage, Failures, MetadataApiDeployStatus } from '@salesforce/source-deploy-retrieve';
import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { ZERO_BORDER_TABLE } from './TableConstants';

export default class DeployErrorDisplayer {
    private static printMetadataFailedToDeploy(componentFailures: DeployMessage | DeployMessage[], logger: Logger) {
        if (componentFailures === null || componentFailures === undefined) return;

        let table = new Table({
            head: ['Metadata Type', 'API Name', 'Problem Type', 'Problem'],
            chars: ZERO_BORDER_TABLE
        });

        let pushComponentFailureIntoTable = (componentFailure) => {
            let item = [
                componentFailure.componentType,
                componentFailure.fullName,
                componentFailure.problemType,
                componentFailure.problem,
            ];
            table.push(item);
        };

        if (componentFailures instanceof Array) {
            for (let failure of componentFailures) {
                pushComponentFailureIntoTable(failure);
            }
        } else {
            let failure = componentFailures;
            pushComponentFailureIntoTable(failure);
        }
        SFPLogger.log('The following components resulted in failures:', LoggerLevel.ERROR, logger);
        SFPLogger.log(table.toString(), LoggerLevel.ERROR, logger);
    }

    public static displayErrors(response: MetadataApiDeployStatus, logger: Logger) {
        SFPLogger.log(`Gathering Final Deployment Status`, null, logger);

        if (response.numberComponentErrors == 0) {
            return 'Unable to fetch report, Check your org for details';
        } else if (response.numberComponentErrors > 0) {
            this.printMetadataFailedToDeploy(response.details.componentFailures, logger);
            return response.errorMessage;
        } else if (response.details.runTestResult) {
            if (response.details.runTestResult.codeCoverageWarnings) {
                this.displayCodeCoverageWarnings(response.details.runTestResult.codeCoverageWarnings, logger);
            }

            if (response.details.runTestResult.failures) {
                this.displayTestFailures(response.details.runTestResult.failures, logger);
            }
            return 'Unable to deploy due to unsatisfactory code coverage and/or test failures';
        } else {
            return 'Unable to fetch report, Check your org for details';
        }
    }

    private static displayCodeCoverageWarnings(
        codeCoverageWarnings: CodeCoverageWarnings | CodeCoverageWarnings[],
        logger: Logger
    ) {
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

        if (table.length > 1) {
            SFPLogger.log(
                'Unable to deploy due to unsatisfactory code coverage, Check the following classes:',
                LoggerLevel.WARN,
                logger
            );
            SFPLogger.log(table.toString(), LoggerLevel.WARN, logger);
        }
    }

    private static displayTestFailures(testFailures: Failures | Failures[], logger: Logger) {
        let table = new Table({
            head: ['Test Name', 'Method Name', 'Message'],
            chars: ZERO_BORDER_TABLE
        });

        if (Array.isArray(testFailures)) {
            testFailures.forEach((elem) => {
                table.push([elem.name, elem.methodName, elem.message]);
            });
        } else {
            table.push([testFailures.name, testFailures.methodName, testFailures.message]);
        }
        if (table.length > 1) {
            SFPLogger.log('Unable to deploy due to test failures:', LoggerLevel.WARN, logger);
            SFPLogger.log(table.toString(), LoggerLevel.WARN, logger);
        }
    }
}
