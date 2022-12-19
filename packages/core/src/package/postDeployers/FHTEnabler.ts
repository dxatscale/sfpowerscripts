import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import {
    ComponentSet,
    registry
} from '@salesforce/source-deploy-retrieve';
import * as fs from 'fs-extra';
import QueryHelper from '../../queryHelper/QueryHelper';
import SfpPackage from '../SfpPackage';
import { Connection } from '@salesforce/core';
import { PostDeployer } from './PostDeployer';
import { Schema } from 'jsforce';
import CustomFieldFetcher from '../../metadata/CustomFieldFetcher';
import SFPOrg from '../../org/SFPOrg';
import path from 'path';
const { XMLBuilder } = require('fast-xml-parser');

const QUERY_BODY =
    'SELECT QualifiedApiName, EntityDefinitionId  FROM FieldDefinition WHERE IsFieldHistoryTracked = true AND EntityDefinitionId IN ';

export default class FHTEnabler implements PostDeployer {
    public async isEnabled(sfpPackage: SfpPackage, conn: Connection<Schema>, logger: Logger): Promise<boolean> {
        if (
            sfpPackage['isFHTFieldFound'] &&
            (sfpPackage.packageDescriptor.enableFHT == undefined || sfpPackage.packageDescriptor.enableFHT == true)
        ) {
            return true;
        }
    }

    public async gatherPostDeploymentComponents(
        sfpPackage: SfpPackage,
        componentSet: ComponentSet,
        conn: Connection,
        logger: Logger
    ): Promise<{ location: string; componentSet: ComponentSet }> {
        //First retrieve all objects/fields  of interest from the package
        let objList = [];
        let fieldList = [];
        Object.keys(sfpPackage['fhtFields']).forEach((key) => {
            objList.push(`'${key}'`);
            sfpPackage['fhtFields'][key].forEach((field) => fieldList.push(key + '.' + field));
        });
        //Now query all the fields for this object where FHT is already enabled
        SFPLogger.log(`Gathering fields which are already  trackHistory enabled in the  target org....`, LoggerLevel.INFO, logger);
        let fhtFieldsInOrg = await QueryHelper.query<{
            QualifiedApiName: string;
            EntityDefinitionId: string;
            IsFieldHistoryTracked:boolean;
        }>(QUERY_BODY + '(' + objList + ')', conn, true);


        //Clear of the fiels that alread has FHT applied and keep a reduced filter
        fhtFieldsInOrg.map((record) => {
            let field = record.EntityDefinitionId + '.' + record.QualifiedApiName;
            const index = fieldList.indexOf(field);
            if (index > -1) {
                fieldList.splice(index, 1);
            }
        });

        if (fieldList.length > 0) {
            //Now retrieve the fields from the org
            let customFieldFetcher: CustomFieldFetcher = new CustomFieldFetcher(logger);
            let sfpOrg = await SFPOrg.create({ connection: conn });
            let fetchedCustomFields = await customFieldFetcher.getCustomFields(sfpOrg, fieldList);

            //Modify the component set
            for (const sourceComponent of fetchedCustomFields.components.getSourceComponents()) {
                let sourceComponentXml = await sourceComponent.parseXml();

                if (sourceComponent.type.name == registry.types.customobject.children.types.customfield.name) {
                    sourceComponentXml['CustomField']['trackHistory'] = true;
                }

                let builder = new XMLBuilder({
                    format: true,
                    ignoreAttributes: false,
                    attributeNamePrefix: '@_',
                });
                let xmlContent = builder.build(sourceComponentXml);
                fs.writeFileSync(path.join(sourceComponent.xml), xmlContent);
            }

            return { location: fetchedCustomFields.location, componentSet: fetchedCustomFields.components };
        }
        else
        SFPLogger.log(`No fields are required to be updated,skipping FHT update`, LoggerLevel.INFO, logger);
    }

    public getName(): string {
        return 'Field History Tracking Enabler';
    }
}

interface CustomField {
    QualifiedApiName: string;
    IsFieldHistoryTracked: boolean;
    EntityDefinitionId: string;
}
