import { ComponentSet, registry } from '@salesforce/source-deploy-retrieve';
import SFPOrg from '../../org/SFPOrg';
import QueryHelper from '../../queryHelper/QueryHelper';
import SFPLogger, { Logger, LoggerLevel } from '@flxblio/sfp-logger';
import {  activate, FlowDefinition } from '../../utils/FlowUtils';
import SfpPackage from '../SfpPackage';
import { Connection } from '@salesforce/core';
import OrgDetailsFetcher from '../../org/OrgDetailsFetcher';
import { Schema } from 'jsforce';
import { DeploymentOptions } from '../../deployers/DeploySourceToOrgImpl';
import { DeploymentContext, DeploymentCustomizer } from "./DeploymentCustomizer";
import { DeploySourceResult } from '../../deployers/DeploymentExecutor';





export default class FlowActivator implements DeploymentCustomizer {
  

  async execute(
    sfpPackage: SfpPackage,
    componentSet: ComponentSet,
    sfpOrg: SFPOrg,
    logger: Logger,
    deploymentContext: DeploymentContext
): Promise<DeploySourceResult> {
    let sourceComponents = componentSet.getSourceComponents().toArray();
    let isFlowFound: boolean = false;
    let flowsToBeActivated = [];

    for (const sourceComponent of sourceComponents) {
      if (sourceComponent.type.name === registry.types.flow.name) {
        flowsToBeActivated.push(sourceComponent.fullName);
        console.log(sourceComponent.fullName);
      }
    }
    if (flowsToBeActivated.length > 0) {
      SFPLogger.log(`Flow found in the package, activating `, LoggerLevel.INFO, logger);
      isFlowFound = true;
      sfpPackage['isFlowFound'] = true;
    }

    try {
      if(isFlowFound){
        let query = `SELECT DeveloperName, ActiveVersion.FullName, ActiveVersion.VersionNumber, NamespacePrefix, LatestVersionId FROM FlowDefinition WHERE DeveloperName IN ('${flowsToBeActivated.join("','")}')`;
        let flowVersionsInOrg = await QueryHelper.query<FlowDefinition>(query, sfpOrg.getConnection(), true);
        //activate the latest version of the flow
        for(const flowVersion of flowVersionsInOrg){
          if(flowVersion.ActiveVersion == null ){
            await activate(flowVersion, sfpOrg);
          }else{
            SFPLogger.log(`Flow ${flowVersion.DeveloperName} has active version, skipping activation`, LoggerLevel.INFO, logger);
          }
        }

      }

      return {
        deploy_id: `000000`,
        result: true,
        message: `Avtivated Flows`,
    };
      } catch (error) {
        SFPLogger.log(`Unable to filter flow, returning the unmodified package`, LoggerLevel.ERROR, logger);
        console.log(error);
        SFPLogger.log(`Error Details : ${error.stack}`, LoggerLevel.TRACE);
    }

  }
  public async isEnabled(sfpPackage: SfpPackage, conn: Connection<Schema>, logger: Logger): Promise<boolean> {
    //ignore if its a scratch org
    const orgDetails = await new OrgDetailsFetcher(conn.getUsername()).getOrgDetails();
    if (orgDetails.isScratchOrg || orgDetails.isSandbox ) return false;
    return true;

  }

    gatherComponentsToBeDeployed(
      sfpPackage: SfpPackage,
      componentSet: ComponentSet,
      conn: Connection<Schema>,
      logger: Logger
    ): Promise<{ location: string; componentSet: ComponentSet }> {
        throw new Error('Method not implemented.');
    }
    getDeploymentOptions(target_org: string, waitTime: string, apiVersion: string): Promise<DeploymentOptions> {
        throw new Error('Method not implemented.');
    }

      public getName(): string {
        return 'Flow Activator';
    }

}




