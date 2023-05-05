import SFPLogger, { COLOR_KEY_MESSAGE, Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { ComponentSet, registry } from '@salesforce/source-deploy-retrieve';
import SfpPackage from '../SfpPackage';
import { Connection } from '@salesforce/core';
import { PreDeployer } from './PreDeployer';
import { Schema } from 'jsforce';
import OrgDetailsFetcher from '../../org/OrgDetailsFetcher';
import fetch from 'node-fetch';
import { List } from 'lodash';
import QueryHelper from '../../queryHelper/QueryHelper';

//const QUERY_BODY = 'select+Id+FROM+FieldDefinition+WHERE+EntityDefinition.QualifiedApiName+=+\'';
const QUERY_BODY =
    'SELECT Id FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = ';


export default class PicklistEnabler implements PreDeployer {
    public async isEnabled(sfpPackage: SfpPackage, conn: Connection<Schema>, logger: Logger): Promise<boolean> {
        //ignore if its a scratch org
        const orgDetails = await new OrgDetailsFetcher(conn.getUsername()).getOrgDetails();
        if (orgDetails.isScratchOrg) return false;

        //TO-DO: add new attributes to sfpPackage & sfpPackage.packageDescriptor
        if (
            sfpPackage['isPicklistFound'] &&
            (sfpPackage.packageDescriptor.enablePicklist == undefined || sfpPackage.packageDescriptor.enablePicklist == true)
        ) {
            return true;
        }
    }

    public async execute(
        componentSet: ComponentSet,
        conn: Connection,
        logger: Logger
    ) {

        try {
            let sourceComponents = componentSet.getSourceComponents().toArray();

            for (const sourceComponent of sourceComponents) {
                if (sourceComponent.type.name !== registry.types.customobject.children.types.customfield.name) {
                    continue;
                }

                let customField = sourceComponent.parseXmlSync().CustomField;
                if (customField['type'] == 'Picklist') {
                    let objName = sourceComponent.parent.fullName;
                    let picklistName = sourceComponent.name;

                    //let baseUrl = conn.baseUrl() + '/services/data/v' + conn.getApiVersion();
                    //let urlId = baseUrl + '/tooling/query/?q=' + QUERY_BODY + objName + '\'+AND+QualifiedApiName+=+\'' + picklistName + '\'';
                    let urlId = QUERY_BODY + objName + 'AND QualifiedApiName = ' + picklistName;

                    let picklistValueSource = await this.getPicklistSource(customField);

                    let picklistInOrg = await this.getPicklistInOrg(urlId, conn);

                    let picklistValueInOrg = [];

                    for (var value in picklistInOrg.valueSet.valueSetDefinition.value) {
                        let valueInfo : { [key: string]: string } = {} ;
                        valueInfo.valueName = value['valueName'];
                        valueInfo.label = value['label'];
                        valueInfo.default = value['default'];
                        picklistValueInOrg.push(valueInfo);
                    }

                    let isDifferent = await this.compareValueSet(picklistValueInOrg, picklistValueSource);

                    if (isDifferent) {
                        this.deployPicklist(picklistInOrg, picklistValueSource, conn);
                    }
                }
            }
        } catch (error) {
            SFPLogger.log(`Unable to process Picklist update due to ${error.message}`,LoggerLevel.TRACE,logger);
        }
    }


    private async getPicklistInOrg(urlId: string, conn: Connection) : Promise<any> {

        SFPLogger.log('PICKLIST QUERY: '+ urlId, LoggerLevel.DEBUG)
        let response = await QueryHelper.query<any>(urlId, conn, true);

        if (response) {
            let responseUrl = response[0].attributes.url;
            let fieldId = responseUrl.slice(responseUrl.lastIndexOf('.') + 1);
            let responsePicklist = await conn.tooling.sobject('CustomField').find({ Id: fieldId });

            if (responsePicklist) {
                return responsePicklist[0].Metadata;
            }
        }
    }

    private async getPicklistSource(customField: any) : Promise<any> {
        let picklistValueSet = [];
        let values = customField['valueSet']['valueSetDefinition'];

        if (values) {
            for (var value in values) {
                //get rid of the sorted attribute
                if (value['fullName'] == null) {
                    continue;
                }
                let valueInfo : { [key: string]: string } = {} ;
                valueInfo.valueName = value['fullName'];
                valueInfo.label = value['label'];
                valueInfo.default = value['default'];
                picklistValueSet.push(valueInfo);
            }
        }
        return picklistValueSet;
    }

    private async compareValueSet(picklistValueInOrg: any[] , picklistValueSource: any[]) : Promise<any> {
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
        picklistInOrg.valueSet.valueSetDefinition.value = [];
        picklistValueSource.map(value => {
            picklistInOrg.valueSet.valueSetDefinition.value.push(value);
        });
        await conn.tooling.sobject('CustomField').update(picklistInOrg);
    }

    public getName(): string {
        return 'Picklist Enabler';
    }
}
