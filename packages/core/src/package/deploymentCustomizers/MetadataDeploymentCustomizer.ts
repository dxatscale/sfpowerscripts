import { Connection } from "@salesforce/core";
import DeploySourceToOrgImpl, { DeploymentOptions } from "../../deployers/DeploySourceToOrgImpl";
import SfpPackage from "../SfpPackage";
import { DeploymentContext, DeploymentCustomizer } from "./DeploymentCustomizer";
import SFPLogger,{COLOR_KEY_MESSAGE,Logger,LoggerLevel} from "@dxatscale/sfp-logger"
import { ComponentSet } from "@salesforce/source-deploy-retrieve";
import SFPOrg from "../../org/SFPOrg";
import DeploymentExecutor, { DeploySourceResult } from "../../deployers/DeploymentExecutor";
import PackageComponentPrinter from "../../display/PackageComponentPrinter";
import DeployErrorDisplayer from "../../display/DeployErrorDisplayer";

export abstract class MetdataDeploymentCustomizer implements DeploymentCustomizer
{
    abstract gatherComponentsToBeDeployed(sfpPackage: SfpPackage, componentSet: ComponentSet, conn: Connection, logger: Logger): Promise<{ location: string; componentSet: ComponentSet; }>;
    abstract isEnabled(sfpPackage: SfpPackage, conn: Connection, logger: Logger): Promise<boolean>;
    abstract getDeploymentOptions(target_org: string, waitTime: string, apiVersion: string): Promise<DeploymentOptions>;
    abstract getName(): string;

    
    async execute(sfpPackage: SfpPackage,
                  componentSet: ComponentSet,
                  sfpOrg:SFPOrg,
                  logger: Logger,
                  deploymentContext:DeploymentContext
                  ):Promise<DeploySourceResult>
    {
        if (await this.isEnabled(sfpPackage, sfpOrg.getConnection(), logger)) {
            SFPLogger.log(
                `Executing Post Deployer ${COLOR_KEY_MESSAGE(this.getName())}`,
                LoggerLevel.INFO,
                logger
            );
            let modifiedPackage = await this.gatherComponentsToBeDeployed(
                sfpPackage,
                componentSet,
                sfpOrg.getConnection(),
                logger
            );

            //Check if there are components to be deployed
            //Asssume its sucessfully deployed
            if (!modifiedPackage || modifiedPackage.componentSet.getSourceComponents().toArray().length == 0) {
                return {
                    deploy_id: `000000`,
                    result: true,
                    message: `No deployment required`,
                };
            }


            //deploy the fht enabled components to the org
            let deploymentOptions = await this.getDeploymentOptions(
                sfpOrg.getUsername(),
                deploymentContext.waitTime,
                deploymentContext.apiVersion
            );

            //Print components inside Component Set
            let components = modifiedPackage.componentSet.getSourceComponents();
            PackageComponentPrinter.printComponentTable(components, logger);

            let deploySourceToOrgImpl: DeploymentExecutor = new DeploySourceToOrgImpl(
                sfpOrg,
                modifiedPackage.location,
                modifiedPackage.componentSet,
                deploymentOptions,
                logger
            );

            let result = await deploySourceToOrgImpl.exec();
            if (!result.result) {
                DeployErrorDisplayer.displayErrors(result.response, logger);
            }
            return result;
        } else {
            SFPLogger.log(
                `Post Deployer ${COLOR_KEY_MESSAGE(this.getName())} skipped or not enabled`,
                LoggerLevel.INFO,
                logger
            );
        }
    }
}