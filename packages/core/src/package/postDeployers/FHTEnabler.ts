import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { ComponentSet, registry } from '@salesforce/source-deploy-retrieve';
import * as fs from 'fs-extra';
import QueryHelper from '../../queryHelper/QueryHelper';
import SfpPackage from '../SfpPackage';
import path from 'path';
import { Connection } from '@salesforce/core';
import { PostDeployer } from './PostDeployer';
import { Schema } from 'jsforce';

const { XMLBuilder } = require('fast-xml-parser');

const QUERY_BODY =
    'SELECT QualifiedApiName, IsFieldHistoryTracked, EntityDefinitionId FROM FieldDefinition WHERE IsFieldHistoryTracked = false AND DurableId IN: ';

export default class FHTEnabler implements PostDeployer {

    public async isEnabled(sfpPackage: SfpPackage, conn: Connection<Schema>, logger: Logger):Promise<boolean> {
        if (sfpPackage['isFHTFieldFound']) {
            return true;
        }
    }

    public async gatherPostDeploymentComponents(
        sfpPackage: SfpPackage,
        conn: Connection,
        logger: Logger
    ): Promise<ComponentSet> {
        

        //Generate component sets
        let componentSet = ComponentSet.fromSource(path.join(sfpPackage.workingDirectory, sfpPackage.packageDirectory));
        let sourceComponents = componentSet.getSourceComponents().toArray();


        //extract the durableId list and object list for the query from the fht Json
        let durableIdList = [];
        let objList = [];
        Object.keys(sfpPackage['fhtFields']).forEach(function (key) {
            objList.push(key);
            sfpPackage['fhtFields'][key].forEach((ele) => durableIdList.push(key + '.' + ele));
        });

        let query = QUERY_BODY + durableIdList;

        try {
            SFPLogger.log(`Gathering fields to be enabled with field history tracking in trget org....`, LoggerLevel.INFO, logger);
            //Fetch the custom fields in the fhtJson from the target org
            let fhtFieldsInOrg = await QueryHelper.query<{
                QualifiedApiName: string;
                IsFieldHistoryTracked: boolean;
                EntityDefinitionId: string;
            }>(query, conn, false);

            let modifiedComponentSet = new ComponentSet();

            for (const sourceComponent of sourceComponents) {
                let sourceComponentXml = sourceComponent.parseXmlSync();
                let componentMatchedByName;

                //if the current component is a field
                if (sourceComponent.type.name === registry.types.customobject.children.types.customfield.name) {
                    //check if the current source component needs to be modified
                    componentMatchedByName = fhtFieldsInOrg.find(
                        (element: CustomField) =>
                            element.QualifiedApiName == sourceComponentXml['CustomField']['name'] &&
                            element.EntityDefinitionId == sourceComponent.parent?.fullName
                    );

                    //update fht setting on the field
                    if (componentMatchedByName) {
                        sourceComponentXml['CustomField']['trackHistory'] = true;
                    }
                }

                //if the current component is an object
                if (sourceComponent.type.name === registry.types.customobject.name) {
                    //check if the current source component needs to be modified
                    componentMatchedByName = objList.find((element: string) => element === sourceComponent.fullName);

                    //update fht setting on the object
                    if (componentMatchedByName) {
                        sourceComponentXml['CustomObject']['enableHistory'] = true;
                    }
                }

                //This is a deployment candidate
                if (componentMatchedByName) {
                    let builder = new XMLBuilder({
                        format: true,
                        ignoreAttributes: false,
                        attributeNamePrefix: '@_',
                    });
                    let xmlContent = builder.build(sourceComponentXml);
                    fs.writeFileSync(sourceComponent.xml, xmlContent);
                    modifiedComponentSet.add(sourceComponent);
                }
            }
            SFPLogger.log(`Completed handling FHT`, LoggerLevel.INFO, logger);
            return modifiedComponentSet;
        } catch (error) {
            SFPLogger.log(`Unable to handle FHT, returning the component set`, LoggerLevel.ERROR, logger);
            return componentSet;
        }
    }
     
    public getName():string
    {
        return "Field History Tracking Enabler"
    }
}

interface CustomField {
    QualifiedApiName: string;
    IsFieldHistoryTracked: boolean;
    EntityDefinitionId: string;
}
