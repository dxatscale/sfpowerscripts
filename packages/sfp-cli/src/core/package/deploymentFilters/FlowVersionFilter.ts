import { ComponentSet, registry } from '@salesforce/source-deploy-retrieve';
import SFPOrg from '../../org/SFPOrg';
import QueryHelper from '../../queryHelper/QueryHelper';
import SFPLogger, { Logger, LoggerLevel } from '@flxblio/sfp-logger';
import { DeploymentFilter } from './DeploymentFilter';
import { PackageType } from '../SfpPackage';
const { XMLBuilder } = require('fast-xml-parser');
import {  deleteFlows, Flow } from '../../utils/FlowUtils';
const Table = require('cli-table');
import { ZERO_BORDER_TABLE } from '../../../ui/TableConstants';


export default class FlowVersionFilter implements DeploymentFilter {

  public async apply(org: SFPOrg, componentSet: ComponentSet, logger: Logger): Promise<ComponentSet> {

    let sourceComponents = componentSet.getSourceComponents().toArray();
    let isFlowFound: boolean = false;

    for (const sourceComponent of sourceComponents) {
      if (sourceComponent.type.name === registry.types.flow.name) {
        isFlowFound = true;
          break;
      }
    }
    if (!isFlowFound) return componentSet;

    try {
      //count flow versions of each flow definition in the org
      let query = `SELECT MasterLabel, COUNT(id) RecordCount FROM Flow GROUP BY MasterLabel`;


      SFPLogger.log(`Checking Flow Versions....`, LoggerLevel.INFO, logger);
      //Fetch Entitlements currently in the org
      let flowVersionsInOrg = await QueryHelper.query<Flow>(query, org.getConnection(), true);
      let tableHead = ['Flow', 'Versions Count'];
      let table = new Table({
        head: tableHead,
        chars: ZERO_BORDER_TABLE,
      });
      for (const flowVersion of flowVersionsInOrg) {
        if(flowVersion.RecordCount == 50){
          SFPLogger.log(`Flow ${flowVersion.MasterLabel} has ${flowVersion.RecordCount} versions, deleting the oldest versions`, LoggerLevel.INFO, logger);
          let flows = await QueryHelper.query<Flow>(`SELECT Id, VersionNumber, FullName, MasterLabel FROM Flow WHERE MasterLabel = '${flowVersion.MasterLabel}' ORDER BY VersionNumber DESC`, org.getConnection(), true);
          let flowsToDelete = flows.slice(49);
          await deleteFlows(flowsToDelete, org);
          flowVersion.RecordCount = 49;
        }
        table.push([flowVersion.MasterLabel, flowVersion.RecordCount]);
      }
      SFPLogger.log(table.toString());
      //let modifiedComponentSet = new ComponentSet();
      

      SFPLogger.log(`Completed cleaning up flow version\n`, LoggerLevel.INFO, logger);
      return componentSet;
      } catch (error) {
        SFPLogger.log(`Unable to filter flow, returning the unmodified package`, LoggerLevel.ERROR, logger);
        console.log(error);
        return componentSet;
    }

  }

  public isToApply(projectConfig: any, packageType: string): boolean {
    if (packageType != PackageType.Source) return false;

    if (projectConfig?.plugins?.sfpowerscripts?.disableEntitlementFilter) return false;
    else return true;
}

}




