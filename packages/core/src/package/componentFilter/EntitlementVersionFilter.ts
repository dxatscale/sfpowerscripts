import { ComponentSet, registry } from '@salesforce/source-deploy-retrieve';
import SFPOrg from '../../org/SFPOrg';
import QueryHelper from '../../queryHelper/QueryHelper';
import SFPLogger, { Logger, LoggerLevel } from '../../logger/SFPLogger';
import { DeploymentFilter } from './DeploymentFilter';
import * as fs from 'fs-extra';
const { XMLBuilder } = require('fast-xml-parser');

const EXISTING_SLAPPROCESS_QUERY = `SELECT Name, NameNorm,VersionNumber, VersionMaster FROM SlaProcess ORDER BY VersionNumber DESC`;

export default class EntitlementVersionFilter implements DeploymentFilter {
    public async apply(org: SFPOrg, componentSet: ComponentSet,logger:Logger): Promise<ComponentSet> {
        //Only do if entitlment exits in the package
        SFPLogger.log(`Filtering Entitlement Process....`,LoggerLevel.INFO,logger);
        let sourceComponents = componentSet.getSourceComponents().toArray();
        let isEntitlementFound: boolean = false;
        for (const sourceComponent of sourceComponents) {
            if (sourceComponent.type.name === registry.types.entitlementprocess.name) {
                isEntitlementFound = true;
                break;
            }
        }
        if (!isEntitlementFound) return componentSet;

        //Fetch Entitlements currently in the org
        let slaProcessesInOrg = await QueryHelper.query<SlaProcess>(
            EXISTING_SLAPPROCESS_QUERY,
            org.getConnection(),
            false
        );

        let modifiedComponentSet = new ComponentSet();

        //Compare version numbers in the org vs version in the component set
        //Remove if the version numbers match
        for (const sourceComponent of sourceComponents) {
            if (sourceComponent.type.name === registry.types.entitlementprocess.name) {
                let slaProcessLocal = sourceComponent.parseXmlSync();

                let slaProcessMatchedByName: SlaProcess = slaProcessesInOrg.find(
                    (element: SlaProcess) => element.Name == slaProcessLocal['EntitlementProcess']['name'] && element.VersionNumber!=null
                );
                if (!slaProcessMatchedByName) {
                    //Doesnt exist, deploy
                    modifiedComponentSet.add(sourceComponent);
                }
                else if (slaProcessLocal['EntitlementProcess']['versionNumber'] > slaProcessMatchedByName.VersionNumber) {
                    //This is a deployment candidate
                    //Modify versionMaster tag to match in the org
                    slaProcessLocal['EntitlementProcess']['versionMaster'] = slaProcessMatchedByName.VersionMaster;
                    let builder = new XMLBuilder({ format: true, ignoreAttributes: false, attributeNamePrefix: '@_' });
                    let xmlContent = builder.build(slaProcessLocal);
                    fs.writeFileSync(sourceComponent.xml, xmlContent);
                    modifiedComponentSet.add(sourceComponent);
                } else {
                    SFPLogger.log(`Skipping EntitlementProcess ${sourceComponent.name} as this version is already deployed`,LoggerLevel.INFO,logger);
                }
            } else {
                modifiedComponentSet.add(sourceComponent);
            }
        }

        SFPLogger.log(`Completed Filtering of EntitlementProcess\n`,LoggerLevel.INFO,logger);
        return modifiedComponentSet;
    }

    public isToApply(projectConfig: any): boolean {
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
