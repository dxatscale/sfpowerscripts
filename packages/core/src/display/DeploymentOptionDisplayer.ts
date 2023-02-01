import SFPLogger, { COLOR_HEADER, COLOR_KEY_MESSAGE, Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { TestLevel } from '../apextest/TestOptions';
import { DeploymentOptions } from '../deployers/DeploySourceToOrgImpl';

export default class DeploymentOptionDisplayer {
    public static printDeploymentOptions(deploymentOptions: DeploymentOptions, logger?: Logger) {
        SFPLogger.log(
            `${COLOR_HEADER(
                `=================================================================================================`
            )}`,
            LoggerLevel.INFO,
            logger
        );
        SFPLogger.log(`${COLOR_HEADER(`Deployment Options`)}`, LoggerLevel.INFO, logger);
        SFPLogger.log(
            `${COLOR_HEADER(
                `=================================================================================================`
            )}`,
            LoggerLevel.INFO,
            logger
        );
        SFPLogger.log(`TestLevel: ${COLOR_KEY_MESSAGE(deploymentOptions.testLevel)}`, LoggerLevel.INFO, logger);
        if (deploymentOptions.testLevel == TestLevel.RunSpecifiedTests)
            SFPLogger.log(
                `Tests to be triggered: ${COLOR_KEY_MESSAGE(deploymentOptions.specifiedTests)}`,
                LoggerLevel.INFO,
                logger
            );

        SFPLogger.log(
            `Ignore Warnings: ${COLOR_KEY_MESSAGE(deploymentOptions.ignoreWarnings)}`,
            LoggerLevel.INFO,
            logger
        );

        SFPLogger.log(
            `Roll Back on Error: ${COLOR_KEY_MESSAGE(deploymentOptions.rollBackOnError)}`,
            LoggerLevel.INFO,
            logger
        );

        SFPLogger.log(`API Version: ${COLOR_KEY_MESSAGE(deploymentOptions.apiVersion)}`, LoggerLevel.INFO, logger);
        SFPLogger.log(
            `${COLOR_HEADER(
                `=================================================================================================`
            )}`,
            LoggerLevel.INFO,
            logger
        );
    }
}
