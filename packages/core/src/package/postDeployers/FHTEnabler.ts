import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { ComponentSet, registry } from '@salesforce/source-deploy-retrieve';
import * as fs from 'fs-extra';
import QueryHelper from '../../queryHelper/QueryHelper';
import SfpPackage from '../SfpPackage';
import { Connection } from '@salesforce/core';
import { PostDeployer } from './PostDeployer';
import { Schema } from 'jsforce';
import CustomFieldFetcher from '../../metadata/CustomFieldFetcher';
import SFPOrg from '../../org/SFPOrg';
import path from 'path';
import OrgDetailsFetcher from '../../org/OrgDetailsFetcher';
import { DeploymentOptions } from '../../deployers/DeploySourceToOrgImpl';
import { TestLevel } from '../../apextest/TestOptions';

const QUERY_BODY =
    'SELECT QualifiedApiName, EntityDefinition.QualifiedApiName  FROM FieldDefinition WHERE IsFieldHistoryTracked = true AND EntityDefinitionId IN ';

export default class FHTEnabler implements PostDeployer {
    public async isEnabled(sfpPackage: SfpPackage, conn: Connection<Schema>, logger: Logger): Promise<boolean> {
        //ignore if its a scratch org
        const orgDetails = await new OrgDetailsFetcher(conn.getUsername()).getOrgDetails();
        if (orgDetails.isScratchOrg) return false;

        if (
            sfpPackage['isFHTFieldFound'] &&
            (sfpPackage.packageDescriptor.enableFHT == undefined || sfpPackage.packageDescriptor.enableFHT == true)
        ) {
            return true;
        }
    }

   

    public async getDeploymentOptions( target_org: string, waitTime: string, apiVersion: string):Promise<DeploymentOptions>
    {
        return {
            ignoreWarnings:true,
            waitTime:waitTime,
            apiVersion:apiVersion,
            testLevel : TestLevel.RunSpecifiedTests,
            specifiedTests :'skip',
            rollBackOnError:true
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
        SFPLogger.log(
            `Gathering fields which are already enabled with trackHistory on target org....`,
            LoggerLevel.INFO,
            logger
        );

        SFPLogger.log('FHT QUERY: '+`${QUERY_BODY + '(' + objList + ')'}`,LoggerLevel.DEBUG)
        let fhtFieldsInOrg = await QueryHelper.query<{
            QualifiedApiName: string;
            EntityDefinition: any;
            IsFieldHistoryTracked: boolean;
        }>(QUERY_BODY + '(' + objList + ')', conn, true);

        //Clear of the fields that alread has FHT applied and keep a reduced filter
        fhtFieldsInOrg.map((record) => {
            let field = record.EntityDefinition.QualifiedApiName + '.' + record.QualifiedApiName;
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
            //Parsing is risky due to various encoding, so do an inplace replacement
            for (const sourceComponent of fetchedCustomFields.components.getSourceComponents()) {
                let metadataOfComponent = fs.readFileSync(sourceComponent.xml).toString();
               
                metadataOfComponent = metadataOfComponent.replace(
                    '<trackHistory>false</trackHistory>',
                    '<trackHistory>true</trackHistory>'
                );

                

                fs.writeFileSync(path.join(sourceComponent.xml), metadataOfComponent);
            }

            return { location: fetchedCustomFields.location, componentSet: fetchedCustomFields.components };
        } else SFPLogger.log(`No fields are required to be updated, skipping update of Field History Tracking`, LoggerLevel.INFO, logger);
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
