import SFPLogger, { Logger, LoggerLevel } from '@flxblio/sfp-logger';
import { ComponentSet, registry } from '@salesforce/source-deploy-retrieve';
import SfpPackage, { PackageType } from '../SfpPackage';
import { Connection } from '@salesforce/core';
import QueryHelper from '../../queryHelper/QueryHelper';
import { DeploymentContext, DeploymentCustomizer } from './DeploymentCustomizer';
import { DeploySourceResult } from '../../deployers/DeploymentExecutor';
import SFPOrg from '../../org/SFPOrg';
import { Schema } from 'jsforce';
import { DeploymentOptions } from '../../deployers/DeploySourceToOrgImpl';
import Bottleneck from "bottleneck";

const QUERY_BODY = 'SELECT Id FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = ';

export default class PicklistEnabler implements DeploymentCustomizer {
    public async isEnabled(sfpPackage: SfpPackage, conn: Connection, logger: Logger): Promise<boolean> {
        if (sfpPackage.packageType === PackageType.Unlocked) {
            if (
                sfpPackage.isPickListsFound &&
                (sfpPackage.packageDescriptor.enablePicklist == undefined ||
                    sfpPackage.packageDescriptor.enablePicklist == true)
            ) {
                return true;
            }
        } else return false;
    }

    async execute(
        sfpPackage: SfpPackage,
        componentSet: ComponentSet,
        sfpOrg: SFPOrg,
        logger: Logger,
        deploymentContext: DeploymentContext
    ): Promise<DeploySourceResult> {
        try {
            let sourceComponents = componentSet.getSourceComponents().toArray();
            let components = [];

            for (const sourceComponent of sourceComponents) {
                if (sourceComponent.type.name == registry.types.customobject.name) {
                    components.push(...sourceComponent.getChildren());
                }

                if (sourceComponent.type.name == registry.types.customobject.children.types.customfield.name) {
                    components.push(sourceComponent);
                }
            }

            if (components) {
                for (const fieldComponent of components) {
                    let customField = fieldComponent.parseXmlSync().CustomField;
                    //check for empty picklists
                    if (
                        !customField ||
                        customField['type'] !== 'Picklist' ||
                        !customField.valueSet?.valueSetDefinition
                    ) {
                        continue;
                    }
                    //no updates for custom metadata picklists
                    if (customField['fieldManageability']) continue;

                    let objName = fieldComponent.parent.fullName;
                    let picklistName = fieldComponent.name;
                    let urlId =
                        QUERY_BODY + "'" + objName + "'" + ' AND QualifiedApiName = ' + "'" + picklistName + "'";

                    let picklistValueSource = await this.getPicklistSource(customField);

                    SFPLogger.log(
                        `Fetching picklist for custom field ${picklistName} on object ${objName}`,
                        LoggerLevel.TRACE,
                        logger
                    );

                    let picklistInOrg = await this.getPicklistInOrg(urlId, sfpOrg.getConnection());

                    //check for empty picklists on org and fix first deployment issue
                    if (!picklistInOrg?.Metadata?.valueSet?.valueSetDefinition) {
                        SFPLogger.log(
                            `Picklist field ${objName}.${picklistName} not in target Org. Skipping`,
                            LoggerLevel.TRACE,
                            logger
                        );
                        continue;
                    }

                    let picklistValueInOrg = [];

                    for (const value of picklistInOrg.Metadata.valueSet.valueSetDefinition.value) {
                        //ignore inactive values from org
                        if (value.isActive == false) {
                            continue;
                        }

                        let valueInfo: { [key: string]: string } = {};
                        valueInfo.fullName = value['valueName'];
                        decodeURIComponent(valueInfo.fullName);
                        valueInfo.label = value['label'];
                        decodeURIComponent(valueInfo.label);
                        valueInfo.default = value['default'] && value['default'] === true ? 'true' : 'false';
                        picklistValueInOrg.push(valueInfo);
                    }

                    let isPickListIdentical = this.arePicklistsIdentical(picklistValueInOrg, picklistValueSource);

                    const limiter = new Bottleneck({maxConcurrent: 1});

                    limiter.on("failed", async (error, jobInfo) => {

                        if (jobInfo.retryCount < 5 && error.message.includes('background')) {
                          return 30000;
                        } else if (jobInfo.retryCount >= 5 && error.message.includes('background')) {
                            throw new Error(`Retry limit exceeded (3 minutes). Unable to process Picklist update.`);
                        } else {
                            throw new Error(`Unable to update picklist for custom field ${objName}.${picklistName} due to ${error.message}`);
                        }
                    });

                    limiter.on("retry", (error, jobInfo) =>  SFPLogger.log(
                        `Background job is beeing executed. Retrying (${jobInfo.retryCount + 1}/5) after 30 seconds...`,
                        LoggerLevel.WARN,
                        logger
                    ));

                    if (!isPickListIdentical) {
                        await limiter.schedule(() => this.deployPicklist(picklistInOrg, picklistValueSource, sfpOrg.getConnection(), logger));
                    } else {
                        SFPLogger.log(
                            `Picklist for custom field ${objName}.${picklistName} is identical to the source.No deployment`,
                            LoggerLevel.TRACE,
                            logger
                        );
                    }
                }

                return {
                    deploy_id: `000000`,
                    result: true,
                    message: `Patched Picklists`,
                };
            }
        } catch (error) {
            throw new Error(`Unable to process Picklist update due to ${error.message}`);
        }
    }

    private async getPicklistInOrg(urlId: string, conn: Connection): Promise<any> {
        let response = await QueryHelper.query<any>(urlId, conn, true);

        if (response && Array.isArray(response) && response.length > 0 && response[0].attributes) {
            let responseUrl = response[0].attributes.url;
            let fieldId = responseUrl.slice(responseUrl.lastIndexOf('.') + 1);
            let responsePicklist = await conn.tooling.sobject('CustomField').find({ Id: fieldId });

            if (responsePicklist) {
                return responsePicklist[0];
            }
        }
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

    private async getPicklistSource(customField: any): Promise<any> {
        let picklistValueSet = [];
        let values = customField.valueSet?.valueSetDefinition?.value;
        //only push values when picklist > 1 or exactly 1 value
        if (Array.isArray(values)) {
            for (const value of values) {
                //ignore inactive values from source
                if (!value?.isActive || value?.isActive == 'true') {
                    picklistValueSet.push({
                        fullName: value['fullName'] ? decodeURI(value['fullName']) : value['fullName'],
                        default: value.default,
                        label: value['label'] ? decodeURI(value['label']) : value['label'],
                    });
                }
            }
        } else if (typeof values === 'object' && 'fullName' in values) {
            //ignore inactive values from source
            if (!values?.isActive || values?.isActive == 'true') {
                picklistValueSet.push({
                    fullName: values['fullName'] ? decodeURI(values['fullName']) : values['fullName'],
                    default: values.default,
                    label: values['label'] ? decodeURI(values['label']) : values['label'],
                });
            }
        }
        return picklistValueSet;
    }

    private arePicklistsIdentical(picklistValueInOrg: any[], picklistValueSource: any[]): boolean {
        return (
            picklistValueInOrg.length === picklistValueSource.length &&
            picklistValueInOrg.every((element_1) =>
                picklistValueSource.some(
                    (element_2) =>
                        element_1.fullName === element_2.fullName &&
                        element_1.label === element_2.label &&
                        element_1.default === element_2.default
                )
            )
        );
    }

    private async deployPicklist(picklistInOrg: any, picklistValueSource: any, conn: Connection, logger: Logger) {
        //empty the the old value set
        picklistInOrg.Metadata.valueSet.valueSetDefinition.value = [];
        picklistValueSource.map((value) => {
            picklistInOrg.Metadata.valueSet.valueSetDefinition.value.push(value);
        });
        picklistInOrg.Metadata.valueSet.valueSettings = [];

        let picklistToDeploy: any;
        picklistToDeploy = {
            attributes: picklistInOrg.attributes,
            Id: picklistInOrg.Id,
            Metadata: picklistInOrg.Metadata,
            FullName: picklistInOrg.FullName,
        };
        SFPLogger.log(`Update picklist for custom field ${picklistToDeploy.FullName}`, LoggerLevel.INFO, logger);
        await conn.tooling.sobject('CustomField').update(picklistToDeploy);

    }

    public getName(): string {
        return 'Picklist Enabler';
    }
}
