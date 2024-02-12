import SFPOrg from '../org/SFPOrg';
import SFPLogger, { Logger, LoggerLevel } from '@flxblio/sfp-logger';



export async function getFlowDefinition(
  opts: FlowOptions,
  org: SFPOrg
): Promise<FlowDefinition> {
  const { developername, namespaceprefix } = opts;
  const conn = org.getConnection();

  let flowDefinitionQuery = `Select Id, ActiveVersionId, DeveloperName, NamespacePrefix, LatestVersionId, LatestVersion.VersionNumber from FlowDefinition where DeveloperName = '${developername}'`;

  if (namespaceprefix) {
    flowDefinitionQuery += ` AND NamespacePrefix = '${namespaceprefix}'`;
  }
  // Query the org
  const result = await conn.tooling.query<FlowDefinition>(flowDefinitionQuery);

  if (!result.records || result.records.length <= 0) {
    throw new SFPLogger.log(`Could not find a definition for flow ${[developername]} in the org.` );
  }

  return result.records[0];
}

export async function getFlowsByDefinition(
  flowdefinition: FlowDefinition,
  org: SFPOrg
): Promise<Flow[]> {
  const conn = org.getConnection();
  let flowQuery = `Select Id, VersionNumber, MasterLabel from Flow where DefinitionId = '${flowdefinition.Id}'`;
  if (flowdefinition.NamespacePrefix) {
    flowQuery += ` AND Definition.NamespacePrefix = '${flowdefinition.NamespacePrefix}'`;
  }
  // Query the org
  
  const result = await conn.tooling.query<Flow>(flowQuery);

  if (!result.records || result.records.length <= 0) {
    throw new SFPLogger.log(`Could not find a definition for flow ${[[flowdefinition.DeveloperName]]} in the org.` );
  }
  return result.records;
}
export async function deleteFlows(flows: Flow[], org: SFPOrg): Promise<any[]> {
  const flowIds = flows.map((flow) => flow.Id);
  const conn = org.getConnection();
  console.log(flowIds);
  
  for(let id of flowIds){
    const results = await conn.tooling.sobject('Flow').del(id);
    if(results.success){
      SFPLogger.log('Deleted flow version with id: ' + id,LoggerLevel.INFO);
    }else{
      SFPLogger.log('Failed to delete flow with id: ' + id + 'ERROR: '+results.errors,LoggerLevel.ERROR);
    }
  }    
  return null;
}
export async function deactivate(flow: FlowDefinition, org: SFPOrg): Promise<any> {
  const conn = org.getConnection();
  const flowResult = await conn.tooling.sobject('FlowDefinition').update({
    Id: flow.Id,
    Metadata: {
      activeVersionNumber: '',
    },
  });

  if (!flowResult || !flowResult.success) {
    throw new SFPLogger.log(`Unable to deactivate flow ${[flow.DeveloperName]}.`);
  }
  return flowResult;
}

export async function activate(flow: FlowDefinition, org: SFPOrg): Promise<any> {
  const conn = org.getConnection();
  const flowResult = await conn.tooling.sobject('FlowDefinition').update({
    Id: flow.Id,
    Metadata: {
      activeVersionNumber: flow.LatestVersion.VersionNumber,
    },
  });

  if (!flowResult || !flowResult.success) {
    throw new SFPLogger.log(`Unable to deactivate flow ${[flow.DeveloperName]}.`);
  }
  return flowResult;
}


export interface Flow {
  Id: string;
  VersionNumber: number;
  FullName: string;
  MasterLabel: string;
  RecordCount: number;
}

export interface FlowDefinition {
  Id: string;
  ActiveVersion: Flow;
  ActiveVersionId: string;
  DeveloperName: string;
  LatestVersion: Flow;
  LatestVersionId: string;
  NamespacePrefix?: string;
}

export interface FlowOptions {
  developername: string;
  namespaceprefix: string;
}