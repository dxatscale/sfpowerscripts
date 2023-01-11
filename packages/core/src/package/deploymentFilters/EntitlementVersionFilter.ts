import { ComponentSet, registry } from '@salesforce/source-deploy-retrieve';
import SFPOrg from '../../org/SFPOrg';
import QueryHelper from '../../queryHelper/QueryHelper';
import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { DeploymentFilter } from './DeploymentFilter';
import * as fs from 'fs-extra';
import SettingsFetcher from '../../metadata/SettingsFetcher';
import { PackageType } from '../SfpPackage';
const { XMLBuilder } = require('fast-xml-parser');

const EXISTING_SLAPPROCESS_QUERY = `SELECT Name, NameNorm,VersionNumber, VersionMaster FROM SlaProcess ORDER BY VersionNumber DESC`;
const EXISTING_SLAPPROCESS_QUERY_NO_VERSIONING = `SELECT Name, NameNorm FROM SlaProcess`;

export default class EntitlementVersionFilter implements DeploymentFilter {
  
    public async apply(org: SFPOrg, componentSet: ComponentSet, logger: Logger): Promise<ComponentSet> {
        //Only do if entitlment exits in the package
        let sourceComponents = componentSet.getSourceComponents().toArray();
        let isEntitlementFound: boolean = false;
        for (const sourceComponent of sourceComponents) {
            if (sourceComponent.type.name === registry.types.entitlementprocess.name) {
                isEntitlementFound = true;
                break;
            }
        }
        if (!isEntitlementFound) return componentSet;

        try {
            let entitlementSettings = await new SettingsFetcher(logger).getSetttingMetadata(org, `Entitlement`);

            let query;
            if (entitlementSettings.enableEntitlementVersioning == true) {
                SFPLogger.log(`Entitlement Versioning enabled in the org....`, LoggerLevel.INFO, logger);
                query = EXISTING_SLAPPROCESS_QUERY;
            } else {
                SFPLogger.log(`Entitlement Versioning not enabled in the org....`, LoggerLevel.INFO, logger);
                query = EXISTING_SLAPPROCESS_QUERY_NO_VERSIONING;
            }

            SFPLogger.log(`Filtering Entitlement Process....`, LoggerLevel.INFO, logger);
            //Fetch Entitlements currently in the org
            let slaProcessesInOrg = await QueryHelper.query<SlaProcess>(query, org.getConnection(), false);
            let modifiedComponentSet = new ComponentSet();
            //Compare version numbers in the org vs version in the component set
            //Remove if the version numbers match
            for (const sourceComponent of sourceComponents) {
                if (sourceComponent.type.name === registry.types.entitlementprocess.name) {
                    let slaProcessLocal = sourceComponent.parseXmlSync();

                    let slaProcessMatchedByName: SlaProcess = slaProcessesInOrg.find(
                        (element: SlaProcess) => element.Name == slaProcessLocal['EntitlementProcess']['name']
                    );

                    if (
                        slaProcessMatchedByName &&
                        entitlementSettings.enableEntitlementVersioning &&
                        slaProcessLocal['EntitlementProcess']['versionNumber'] > slaProcessMatchedByName.VersionNumber
                    ) {
                        //This is a deployment candidate
                        //Modify versionMaster tag to match in the org
                        slaProcessLocal['EntitlementProcess']['versionMaster'] = slaProcessMatchedByName.VersionMaster;
                        let builder = new XMLBuilder({
                            format: true,
                            ignoreAttributes: false,
                            attributeNamePrefix: '@_',
                        });
                        let xmlContent = builder.build(slaProcessLocal);
                        fs.writeFileSync(sourceComponent.xml, xmlContent);
                        modifiedComponentSet.add(sourceComponent);
                    } else if (slaProcessMatchedByName) {
                        SFPLogger.log(
                            `Skipping EntitlementProcess ${sourceComponent.name} as this version is already deployed`,
                            LoggerLevel.INFO,
                            logger
                        );
                    } else {
                        //Doesnt exist, deploy
                        modifiedComponentSet.add(sourceComponent);
                    }
                } else {
                    modifiedComponentSet.add(sourceComponent);
                }
            }

            SFPLogger.log(`Completed Filtering of EntitlementProcess\n`, LoggerLevel.INFO, logger);
            return modifiedComponentSet;
        } catch (error) {
            SFPLogger.log(`Unable to filter entitlements, returning the unmodified package`, LoggerLevel.ERROR, logger);
            return componentSet;
        }
    }

    public isToApply(projectConfig: any, packageType: string): boolean {
        if (packageType != PackageType.Source) return false;

        if (projectConfig?.plugins?.sfpowerscripts?.disableEntitlementFilter) return false;
        else return true;
    }

    

   
}

interface SlaProcess {
    Name: string;
    NameNorm: string;
    VersionNumber: string;
    VersionMaster: string;
}
