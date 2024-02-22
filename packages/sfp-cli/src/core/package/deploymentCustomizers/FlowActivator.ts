import { ComponentSet, registry } from '@salesforce/source-deploy-retrieve';
import SFPOrg from '../../org/SFPOrg';
import QueryHelper from '../../queryHelper/QueryHelper';
import SFPLogger, { Logger, LoggerLevel } from '@flxblio/sfp-logger';
import { activate, deactivate, deleteFlows, Flow, FlowDefinition, getFlowDefinition } from '../../flows/FlowOperations';
import SfpPackage, { PackageType } from '../SfpPackage';
import { Connection } from '@salesforce/core';
import OrgDetailsFetcher from '../../org/OrgDetailsFetcher';
import { Schema } from 'jsforce';
import { DeploymentOptions } from '../../deployers/DeploySourceToOrgImpl';
import { DeploymentContext, DeploymentCustomizer } from './DeploymentCustomizer';
import { DeploySourceResult } from '../../deployers/DeploymentExecutor';
import { ZERO_BORDER_TABLE } from '../../display/TableConstants';
const Table = require('cli-table');

export default class FlowActivator implements DeploymentCustomizer {
    async execute(
        sfpPackage: SfpPackage,
        componentSet: ComponentSet,
        sfpOrg: SFPOrg,
        logger: Logger,
        deploymentContext: DeploymentContext
    ): Promise<DeploySourceResult> {
        let sourceComponents = componentSet.getSourceComponents().toArray();
        let masterLabelsOfAllFlowsInPackage = [];
        let flowsToBeActivated = [];
        let flowsToBeDeactivated = [];

        for (const sourceComponent of sourceComponents) {
            if (sourceComponent.type.name === registry.types.flow.name) {
                //Parse Flows
                //Determining the flow to be activated
                let flowAsJSON = sourceComponent.parseXmlSync();
                masterLabelsOfAllFlowsInPackage.push(flowAsJSON['Flow']['label']);
                if (flowAsJSON['Flow']['status'] == 'Active') {
                    flowsToBeActivated.push(sourceComponent.fullName);
                } else {
                    flowsToBeDeactivated.push(sourceComponent.fullName);
                }
            }
        }

        try {
            if (masterLabelsOfAllFlowsInPackage.length > 0) {
           // Need to move this to a seperate pre deployment process
          //  await this.cleanupOldestFlowVersion(masterLabelsOfAllFlowsInPackage, sfpOrg, logger);

                if (flowsToBeActivated.length > 0) {
                    SFPLogger.log(
                        `Active flows found in the package, attempting to activate latest versions`,
                        LoggerLevel.INFO,
                        logger
                    );
                    await this.activateLatestVersionOfFlows(flowsToBeActivated, sfpOrg, logger);
                }
                if (flowsToBeDeactivated.length > 0) {
                    SFPLogger.log(
                        `Obsolete/Draft/InvalidDraft flows found in the package, attempting to inactivate the flow`,
                        LoggerLevel.INFO,
                        logger
                    );
                    await this.deactivateFlow(flowsToBeDeactivated, sfpOrg, logger);
                }
            }

            return {
                deploy_id: `000000`,
                result: true,
                message: `Activated/Inactivated Flows`,
            };
        } catch (error) {
            SFPLogger.log(`Unable to activate flow, skipping activation`, LoggerLevel.ERROR, logger);
            console.log(error);
            SFPLogger.log(`Error Details : ${error.stack}`, LoggerLevel.TRACE);
        }
    }
    private async activateLatestVersionOfFlows(flowsToBeActivated: string[], sfpOrg: SFPOrg, logger: Logger) {
        let query = `SELECT DeveloperName, ActiveVersion.FullName, ActiveVersion.VersionNumber, NamespacePrefix, LatestVersionId FROM FlowDefinition WHERE DeveloperName IN ('${flowsToBeActivated.join(
            "','"
        )}')`;
        let flowVersionsInOrg = await QueryHelper.query<FlowDefinition>(query, sfpOrg.getConnection(), true);
        //activate the latest version of the flow
        for (const flowVersion of flowVersionsInOrg) {
            if (flowVersion.ActiveVersion == null) {
                await activate(flowVersion, sfpOrg);
                SFPLogger.log(
                    `Flow ${flowVersion.DeveloperName} is activated in the org sucessfully`,
                    LoggerLevel.INFO,
                    logger
                );
            } else {
                SFPLogger.log(
                    `Flow ${flowVersion.DeveloperName}'s latest version is already active, skipping activation`,
                    LoggerLevel.INFO,
                    logger
                );
            }
        }
    }

    private async deactivateFlow(flowsToBeDeactivated: string[], sfpOrg: SFPOrg, logger: Logger) {
        for (const flow of flowsToBeDeactivated) {
            try {
                const flowdefinition = await getFlowDefinition(
                    {
                        developername: flow,
                        namespaceprefix: '',
                    },
                    sfpOrg
                );

                await deactivate(flowdefinition, sfpOrg);
                SFPLogger.log(`Flow ${flow} is marked as inactive in the org sucessfully`, LoggerLevel.INFO, logger);
            } catch (error) {
                SFPLogger.log(`Unable to deactive flow ${flow}, skipping deactivation`, LoggerLevel.ERROR, logger);
                SFPLogger.log(`Error Details : ${error.stack}`, LoggerLevel.TRACE);
            }
        }
    }

    public async isEnabled(sfpPackage: SfpPackage, conn: Connection<Schema>, logger: Logger): Promise<boolean> {
        if(sfpPackage.packageDescriptor.package_type == PackageType.Data)
            return false;
        if (
            sfpPackage.packageDescriptor.enableFlowActivation == undefined ||
            sfpPackage.packageDescriptor.enableFlowActivation == true
        ) {
            return true;
        }
        return false;
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

    private async cleanupOldestFlowVersion(masterLabelsOfAllFlowsInPackage: string[], sfpOrg: SFPOrg, logger: Logger) {
        try {
            //count flow versions of each flow definition in the org
            SFPLogger.log(`Checking current versions of flows`, LoggerLevel.INFO, logger);

            let query = `SELECT MasterLabel, COUNT(id) RecordCount FROM Flow GROUP BY MasterLabel`;
            let isFlowVersionPurgeDetected = false;

            let flowVersionsInOrg = await QueryHelper.query<Flow>(query, sfpOrg.getConnection(), true);
            let tableHead = ['Flow', 'Versions Count', 'Action'];
            let table = new Table({
                head: tableHead,
                chars: ZERO_BORDER_TABLE,
            });
            for (const flowVersion of flowVersionsInOrg) {
                try {
                    if (
                        flowVersion.RecordCount == 50 &&
                        masterLabelsOfAllFlowsInPackage.includes(flowVersion.MasterLabel)
                    ) {
                        isFlowVersionPurgeDetected = true;
                        SFPLogger.log(
                            `Flow ${flowVersion.MasterLabel} has ${flowVersion.RecordCount} versions, deleting the oldest versions`,
                            LoggerLevel.INFO,
                            logger
                        );
                        let flows = await QueryHelper.query<Flow>(
                            `SELECT Id, VersionNumber, FullName, MasterLabel FROM Flow WHERE MasterLabel = '${flowVersion.MasterLabel}' ORDER BY VersionNumber DESC`,
                            sfpOrg.getConnection(),
                            true
                        );
                        let flowsToDelete = flows.slice(49);
                        await deleteFlows(flowsToDelete, sfpOrg, logger);
                        table.push([flowVersion.MasterLabel, flowVersion.RecordCount, 'Deleted 1 version']);
                    }
                } catch (error) {
                    SFPLogger.log(
                        `Unable to purge flow versions for ${flowVersion.MasterLabel}, skipping`,
                        LoggerLevel.ERROR,
                        logger
                    );
                    table.push([flowVersion.MasterLabel, flowVersion.RecordCount, 'Unable to delete versions']);
                    SFPLogger.log(`Error Details : ${error.stack}`, LoggerLevel.TRACE);
                }
            }
            if (table.length > 1 && isFlowVersionPurgeDetected) {
                SFPLogger.log(table.toString());
            } else {
                SFPLogger.log(
                    `All flows in the package have less than 50 versions, skipping version cleanup`,
                    LoggerLevel.INFO,
                    logger
                );
            }
        } catch (error) {
            SFPLogger.log(`Unable to cleanup flow versions`, LoggerLevel.ERROR, logger);
            SFPLogger.log(`Error Details : ${error.stack}`, LoggerLevel.TRACE);
        }
    }
}
