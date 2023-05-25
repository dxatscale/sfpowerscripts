import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { ComponentSet, registry } from '@salesforce/source-deploy-retrieve';
import SfpPackage, { PackageType } from '../SfpPackage';
import { Connection } from '@salesforce/core';
import { PreDeployer } from './PreDeployer';
import { Schema } from 'jsforce';
import QueryHelper from '../../queryHelper/QueryHelper';

const QUERY_BODY =
    'SELECT Id FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = ';


export default class PicklistEnabler implements PreDeployer {
    public async isEnabled(sfpPackage: SfpPackage, conn: Connection<Schema>, logger: Logger): Promise<boolean> {

        if (sfpPackage.packageType === PackageType.Unlocked) {
            if (
                sfpPackage.isPickListsFound &&
                (sfpPackage.packageDescriptor.enablePicklist == undefined || sfpPackage.packageDescriptor.enablePicklist == true)
            ) {
                return true;
            }
        }
        else
          return false;
    }

    public async execute(
        componentSet: ComponentSet,
        conn: Connection,
        logger: Logger
    ) {

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

                    if (customField['type'] !== 'Picklist') {
                        continue;
                    }

                    let objName = fieldComponent.parent.fullName;
                    let picklistName = fieldComponent.name;
                    let urlId = QUERY_BODY + '\'' + objName + '\'' + ' AND QualifiedApiName = ' + '\'' + picklistName + '\'';

                    let picklistValueSource = await this.getPicklistSource(customField);

                    let picklistInOrg = await this.getPicklistInOrg(urlId, conn);

                    let picklistValueInOrg = [];

                    for (const value of picklistInOrg.Metadata.valueSet.valueSetDefinition.value) {

                        if (value.isActive == false) {
                            continue;
                        }

                        let valueInfo: { [key: string]: string } = {};
                        valueInfo.valueName = value['valueName'];
                        valueInfo.label = value['label'];
                        valueInfo.default = value['default'];
                        picklistValueInOrg.push(valueInfo);
                    }

                    let notChanged = await this.compareValueSet(picklistValueInOrg, picklistValueSource);

                    if (notChanged == false) {
                        this.deployPicklist(picklistInOrg, picklistValueSource, conn);
                    }
                }
            }
        } catch (error) {
            SFPLogger.log(`Unable to process Picklist update due to ${error.message}`, LoggerLevel.WARN, logger);
        }
    }


    private async getPicklistInOrg(urlId: string, conn: Connection): Promise<any> {

        let response = await QueryHelper.query<any>(urlId, conn, true);

        if (response) {
            let responseUrl = response[0].attributes.url;
            let fieldId = responseUrl.slice(responseUrl.lastIndexOf('.') + 1);
            let responsePicklist = await conn.tooling.sobject('CustomField').find({ Id: fieldId });

            if (responsePicklist) {
                return responsePicklist[0];
            }
        }
    }

    private async getPicklistSource(customField: any): Promise<any> {
        let picklistValueSet = [];
        let values = customField.valueSet.valueSetDefinition.value;

        for (const [key, value] of Object.entries(values)) {
            let valueInfo: { [key: string]: string } = {};
            valueInfo.valueName = value['fullName'];
            valueInfo.label = value['label'];
            valueInfo.default = value['default'];
            picklistValueSet.push(valueInfo);
          }
        return picklistValueSet;
    }

    private async compareValueSet(picklistValueInOrg: any[], picklistValueSource: any[]): Promise<any> {
        return (
            picklistValueInOrg.length === picklistValueSource.length &&
            picklistValueInOrg.every((element_1) =>
                picklistValueSource.some(
                    (element_2) =>
                        element_1.valueName === element_2.valueName &&
                        element_1.label === element_2.label &&
                        element_1.default === element_2.default
                )
            )
        );
    }

    private async deployPicklist(picklistInOrg: any, picklistValueSource: any, conn: Connection) {
        //empty the the old value set
        picklistInOrg.Metadata.valueSet.valueSetDefinition.value = [];
        picklistValueSource.map(value => {
            picklistInOrg.Metadata.valueSet.valueSetDefinition.value.push(value);
        });
        picklistInOrg.Metadata.valueSet.valueSettings = [];


        let picklistToDeploy : any;
        picklistToDeploy = {attributes: picklistInOrg.attributes,
                            Id: picklistInOrg.Id,
                                Metadata: picklistInOrg.Metadata,
                                FullName: picklistInOrg.FullName};

        await conn.tooling.sobject('CustomField').update(picklistToDeploy);
    }

    public getName(): string {
        return 'Picklist Enabler';
    }
}
