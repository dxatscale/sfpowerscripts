import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { ComponentSet, registry } from '@salesforce/source-deploy-retrieve';
import * as fs from 'fs-extra';
import QueryHelper from '../../queryHelper/QueryHelper';
import SfpPackage from '../SfpPackage';
import path from 'path';
import { Connection } from '@salesforce/core';

const { XMLBuilder } = require('fast-xml-parser');

const QUERY_BODY = 'SELECT QualifiedApiName, IsFieldHistoryTracked, EntityDefinitionId FROM FieldDefinition WHERE IsFieldHistoryTracked = false AND DurableId IN: ';

export default class FHTPostDeploymentGenerator {

    public static async generateFHTEnabledComponents(sfpPackage: SfpPackage, conn: Connection, logger: Logger): Promise<ComponentSet> {

        //only do if isFHTFieldsFound is true
        if(!sfpPackage.isFHTFieldsFound) {
            return;
        }

        //Generate component sets
        let componentSet = ComponentSet.fromSource(path.join(sfpPackage.workingDirectory, sfpPackage.packageDirectory));
        let sourceComponents = componentSet.getSourceComponents().toArray();

        //read json to get the object names and field names
        let filePath;
        if (sfpPackage.workingDirectory != null) filePath = path.join(sfpPackage.workingDirectory, 'postDeployTransfomations/fhtJson.json');

        let fhtJson = fs.readFileSync(filePath, 'utf8');

        let parsedFHTJson = JSON.parse(fhtJson);

        //extract the durableId list and object list for the query from the fht Json
        let durableIdList = [];
        let objList = [];
        Object.keys(parsedFHTJson).forEach(function(key) {
            objList.push(key);
            parsedFHTJson[key].forEach(ele => durableIdList.push(key + '.' + ele));
        });

        let query = QUERY_BODY + durableIdList;

        try {
            SFPLogger.log(`Enabling FHT In the Target Org....`, LoggerLevel.INFO, logger);
            //Fetch the custom fields in the fhtJson from the target org
            let fhtFieldsInOrg = await QueryHelper.query<{ QualifiedApiName: string; IsFieldHistoryTracked: boolean, EntityDefinitionId: string }>(query, conn, false);

            let modifiedComponentSet = new ComponentSet();

            for (const sourceComponent of sourceComponents) {
                let fieldLocal = sourceComponent.parseXmlSync();

                let componentMatchedByName;

                //if the current component is a field
                if (sourceComponent.type.name === registry.types.customobject.children.types.customfield.name) {

                    //check if the current source component needs to be modified
                    componentMatchedByName = fhtFieldsInOrg.find(
                        (element: CustomField) => element.QualifiedApiName == fieldLocal['CustomField']['name'] && element.EntityDefinitionId == sourceComponent.parent?.fullName
                    );

                    //update fht setting on the field
                    if (componentMatchedByName) {
                        fieldLocal['CustomField']['trackHistory'] = true;
                    }
                }

                //if the current component is an object
                if (sourceComponent.type.name === registry.types.customobject.name) {

                    //check if the current source component needs to be modified
                    componentMatchedByName = objList.find(
                        (element: string) => element === sourceComponent.fullName
                    );

                    //update fht setting on the object
                    if (componentMatchedByName) {
                        fieldLocal['CustomObject']['enableHistory'] = true;
                    }
                }

                //This is a deployment candidate
                if (componentMatchedByName) {
                    let builder = new XMLBuilder({
                        format: true,
                        ignoreAttributes: false,
                        attributeNamePrefix: '@_',
                    });
                    let xmlContent = builder.build(fieldLocal);
                    fs.writeFileSync(sourceComponent.xml, xmlContent);
                    modifiedComponentSet.add(sourceComponent);
                }
            }
            SFPLogger.log(`Completed handling FHT\n`, LoggerLevel.INFO, logger);
            return modifiedComponentSet;
        } catch (error) {
            SFPLogger.log(`Unable to handle FHT, returning the unmodified package`, LoggerLevel.ERROR, logger);
            return componentSet;
        }
    }
}

interface CustomField {
    QualifiedApiName: string;
    IsFieldHistoryTracked: boolean;
    EntityDefinitionId: string;
}
