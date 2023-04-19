import SFPLogger, { COLOR_KEY_MESSAGE, Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { ComponentSet, registry } from '@salesforce/source-deploy-retrieve';
import SfpPackage from '../SfpPackage';
import { Connection } from '@salesforce/core';
import { PreDeployer } from './PreDeployer';
import { Schema } from 'jsforce';
import OrgDetailsFetcher from '../../org/OrgDetailsFetcher';
import fetch from 'node-fetch';
import { List } from 'lodash';

const QUERY_BODY = 'select+Id+FROM+FieldDefinition+WHERE+EntityDefinition.QualifiedApiName+=+\'';

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

                    let baseUrl = conn.baseUrl() + '/services/data/v' + conn.getApiVersion();
                    let urlId = baseUrl + '/tooling/query/?q=' + QUERY_BODY + objName + '\'+AND+QualifiedApiName+=+\'' + picklistName + '\'';

                    let picklistValueInOrg = await this.getPicklistInOrg(urlId, baseUrl);

                    let picklistValueSource = await this.getPicklistSource(customField);

                    let isDifferent = await this.compareValueSet(picklistValueInOrg, picklistValueSource);

                    if (isDifferent) {
                        this.deployPicklist(picklistValueSource); //TO-DO
                    }
                }
            }
        } catch (error) {
            SFPLogger.log(`Unable to process Picklist update due to ${error.message}`,LoggerLevel.TRACE,logger);
        }
    }

    private async getPicklistInOrg(urlId: string, baseUrl: string) : Promise<any> {
        let picklistValueSet = [];

        //for testing only
        let access_token = '00D2w00000RJsSM!AQsAQJmR8Ga0v_p6.1Ystt1uJP9JU0T7lbqUeHrW82WGn1OFfVF_sVjWNDhHcwuu33opLOGtTi2z7lgT1UjcfDfyJeFUCUsO';
        const response = await fetch(urlId, {
            headers: {"Authorization": "Bearer " + access_token}
          });

        if (response.ok) {
            let responseUrl = (await response.json()).records[0].attributes.url;
            let urlField = baseUrl + 'sobjects/CustomField/' + responseUrl.slice(responseUrl.lastIndexOf('.') + 1);

            const responsePicklist = await fetch(urlField, {
                headers: {"Authorization": "Bearer " + access_token}
            });

            if (responsePicklist.ok) {
                let valueSet = (await responsePicklist.json()).Metadata.valueSet.valueSetDefinition.value;

                for (var value in valueSet) {
                    let valueInfo : { [key: string]: string } = {} ;
                    valueInfo.valueName = value['valueName'];
                    valueInfo.label = value['label'];
                    valueInfo.default = value['default'];
                    picklistValueSet.push(valueInfo);
                }
            }
        }
        return picklistValueSet;
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

    private async compareValueSet(picklistValueInOrg: List<any> , picklistValueSource: List<any>) : Promise<any> {
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

    private deployPicklist(picklistValueSource: any) {

    }

    public getName(): string {
        return 'Picklist Enabler';
    }
}
