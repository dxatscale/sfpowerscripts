import { Query, SaveResult } from 'jsforce';
import SFPOrg from '../org/SFPOrg';
import SFPLogger, { Logger, LoggerLevel } from '@flxblio/sfp-logger';
import QueryHelper from '../queryHelper/QueryHelper';
const retry = require('async-retry');

export async function getFlowDefinition(opts: FlowOptions, org: SFPOrg, logger?: Logger): Promise<FlowDefinition> {
    const { developername, namespaceprefix } = opts;
    const conn = org.getConnection();

    let flowDefinitionQuery = `Select Id, ActiveVersionId, DeveloperName, NamespacePrefix, LatestVersionId, LatestVersion.VersionNumber from FlowDefinition where DeveloperName = '${developername}'`;

    if (namespaceprefix) {
        flowDefinitionQuery += ` AND NamespacePrefix = '${namespaceprefix}'`;
    }
    // Query the org
    const records = await QueryHelper.query(flowDefinitionQuery, conn, true);

    if (!records || records.length <= 0) {
        throw new Error(`Could not find a definition for flow ${[developername]} in the org.`);
    }

    return records[0] as FlowDefinition;
}

export async function getFlowsByDefinition(
    flowdefinition: FlowDefinition,
    org: SFPOrg,
    logger: Logger
): Promise<Flow[]> {
    const conn = org.getConnection();
    let flowQuery = `Select Id, VersionNumber, MasterLabel from Flow where DefinitionId = '${flowdefinition.Id}'`;
    if (flowdefinition.NamespacePrefix) {
        flowQuery += ` AND Definition.NamespacePrefix = '${flowdefinition.NamespacePrefix}'`;
    }
    // Query the org

    const records = await QueryHelper.query(flowQuery, conn, true);

    if (!records || records.length <= 0) {
        throw new Error(`Could not find a definition for flow ${[[flowdefinition.DeveloperName]]} in the org.`);
    }
    return records as Flow[];
}

export async function deleteFlows(flows: Flow[], org: SFPOrg, logger: Logger): Promise<string[]> {
    const flowIds = flows.map((flow) => flow.Id);
    const conn = org.getConnection();
    const succeededFlows = [];
    for (let id of flowIds) {
         await retry(
            async (bail) => {
                const results = await conn.tooling.sobject('Flow').del(id);
                if (results.success) {
                    SFPLogger.log('Deleted flow version with id: ' + id, LoggerLevel.INFO);
                    succeededFlows.push(id);
                } else {
                    throw new Error(`Unable to delete flow version with id: ${id},retrying in 5 seconds...`)
                }
            },
            { retries: 3, minTimeout: 5000 }
        );
    }
    return succeededFlows;
}

export async function deactivate(flow: FlowDefinition, org: SFPOrg): Promise<SaveResult> {
    const conn = org.getConnection();
    const flowResult = await conn.tooling.sobject('FlowDefinition').update({
        Id: flow.Id,
        Metadata: {
            activeVersionNumber: '',
        },
    });

    if (!flowResult || !flowResult.success) {
        throw new Error(`Unable to deactivate flow ${[flow.DeveloperName]}.`);
    }
    return flowResult;
}

export async function activate(flow: FlowDefinition, org: SFPOrg): Promise<SaveResult> {
    const conn = org.getConnection();
    const flowResult = await conn.tooling.sobject('FlowDefinition').update({
        Id: flow.Id,
        Metadata: {
            activeVersionNumber: flow.LatestVersion.VersionNumber,
        },
    });

    if (!flowResult || !flowResult.success) {
        throw new Error(`Unable to activate flow ${[flow.DeveloperName]}.`);
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
