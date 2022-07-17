import { jest, expect } from '@jest/globals';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { ConsoleLogger } from '@dxatscale/sfp-logger';
import { AnyJson } from '@salesforce/ts-types';
import SFPOrg from '../../../src/org/SFPOrg';
import { ComponentSet, VirtualDirectory, VirtualTreeContainer } from '@salesforce/source-deploy-retrieve';
import EntitlementVersionFilter from '../../../src/package/deploymentFilters/EntitlementVersionFilter';

const fs = require('fs-extra');


const $$ = testSetup();
const createOrg = async () => {
    const testData = new MockTestOrgData();

    $$.setConfigStubContents('AuthInfoConfig', {
        contents: await testData.getConfig(),
    });

    return await SFPOrg.create({ aliasOrUsername: testData.username });
};

let entitlementSetting:any={};
jest.mock('../../../src/metadata/MetadataFetcher', () => {
    class MetadataFetcher {
        getSetttingMetadata= jest.fn().mockReturnValue(entitlementSetting)
    }

    return MetadataFetcher;
});


describe('Filter entitlements during deployment', () => {

    beforeEach(() => {
       const fsMock = jest.spyOn(fs, 'writeFileSync');
        fsMock.mockImplementationOnce(() => {
            return ;
        });
    });

    it('Should return a component set by filtering entitlement versions which are existing in the org', async () => {
      
        let org = await createOrg();
        let records: AnyJson = {
            records: [
                {
                    Name: 'TestEntitlement1',
                    NameNorm: 'testentitlement1_v1',
                    VersionNumber: 1,
                    VersionMaster:'5522N000000c01Q',
                }
            ],
        };
        $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
            return Promise.resolve(records);
        };


        const virtualFs: VirtualDirectory[] = [
          {
            dirPath: '/metadata/entitlementProcesses',
            children: [
              {
                name: 'testentitlement1_v1.entitlementProcess-meta.xml',
                data: Buffer.from(TESTENTITLEMENT_1)
              },
              {
                name: 'testentitlement2_v1.entitlementProcess',
                data: Buffer.from(TESTENTITLEMENT_2)
              }
            ]
          }
        ]

       
        
        // resolve components of a virtual tree
        const virtualTree = new VirtualTreeContainer(virtualFs);
        const componentSet = ComponentSet.fromSource({
            fsPaths: ['/metadata/entitlementProcesses'],
            tree: virtualTree,
        });
        let entitlementVersionFilter:EntitlementVersionFilter=new EntitlementVersionFilter();
        entitlementSetting={
            "enableEntitlementVersioning":true
        };
        let modifiedComponentSet = await entitlementVersionFilter.apply(org,componentSet,new ConsoleLogger());
        
        let sourceComponents = modifiedComponentSet.getSourceComponents().toArray();
        expect(sourceComponents.find((element)=>element.name==`testentitlement1_v1`)).toBeUndefined();
        expect(sourceComponents.find((element)=>element.name==`testentitlement2_v1`)).toBeDefined();



    });

    it('Should only return component sets when the version number is higher than whats existing in the org', async () => {
        entitlementSetting={enableEntitlementVersioning:true};
        let org = await createOrg();
        let records: AnyJson = {
            records: [
                {
                    Name: 'TestEntitlement1',
                    NameNorm: 'testentitlement1_v1',
                    VersionNumber: 1,
                    VersionMaster:'5522N000000c01Q',
                },
                {
                    Name: 'TestEntitlement2',
                    NameNorm: 'testentitlement2_v1',
                    VersionNumber: 1,
                    VersionMaster:'5522O000000LlFu',
                }
            ],
        };
        $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
            return Promise.resolve(records);
        };


        const virtualFs: VirtualDirectory[] = [
          {
            dirPath: '/metadata/entitlementProcesses',
            children: [
              {
                name: 'testentitlement1_v1.entitlementProcess-meta.xml',
                data: Buffer.from(TESTENTITLEMENT_1)
              },
              {
                name: 'testentitlement2_v1.entitlementProcess-meta.xml',
                data: Buffer.from(TESTENTITLEMENT_2)
              },
              {
                name: 'testentitlement2_v2.entitlementProcess',
                data: Buffer.from(TESTENTITLEMENT_2_V2)
              }
            ]
          }
        ]

       
        
        // resolve components of a virtual tree
        const virtualTree = new VirtualTreeContainer(virtualFs);
        const componentSet = ComponentSet.fromSource({
            fsPaths: ['/metadata/entitlementProcesses'],
            tree: virtualTree,
        });
        let entitlementVersionFilter:EntitlementVersionFilter=new EntitlementVersionFilter();
        let modifiedComponentSet = await entitlementVersionFilter.apply(org,componentSet,new ConsoleLogger());
        
        let sourceComponents = modifiedComponentSet.getSourceComponents().toArray();
        expect(sourceComponents.find((element)=>element.name==`testentitlement1_v1`)).toBeUndefined();
        expect(sourceComponents.find((element)=>element.name==`testentitlement2_v1`)).toBeUndefined();
        expect(sourceComponents.find((element)=>element.name==`testentitlement2_v2`)).toBeDefined();



    });


    it('should return all components when there are no existing versions in the org', async () => {
        entitlementSetting={enableEntitlementVersioning:true};
        let org = await createOrg();
        let records: AnyJson = {
            records: [
            ],
        };
        $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
            return Promise.resolve(records);
        };


        const virtualFs: VirtualDirectory[] = [
          {
            dirPath: '/metadata/entitlementProcesses',
            children: [
              {
                name: 'testentitlement1_v1.entitlementProcess-meta.xml',
                data: Buffer.from(TESTENTITLEMENT_1)
              },
              {
                name: 'testentitlement2_v1.entitlementProcess',
                data: Buffer.from(TESTENTITLEMENT_1)
              }
            ]
          }
        ]

       
        
        // resolve components of a virtual tree
        const virtualTree = new VirtualTreeContainer(virtualFs);
        const componentSet = ComponentSet.fromSource({
            fsPaths: ['/metadata/entitlementProcesses'],
            tree: virtualTree,
        });
        let entitlementVersionFilter:EntitlementVersionFilter=new EntitlementVersionFilter();
        let modifiedComponentSet = await entitlementVersionFilter.apply(org,componentSet,new ConsoleLogger());
        
        let sourceComponents = modifiedComponentSet.getSourceComponents().toArray();
        expect(sourceComponents.find((element)=>element.name==`testentitlement1_v1`)).toBeDefined();
        expect(sourceComponents.find((element)=>element.name==`testentitlement2_v1`)).toBeDefined();



    });

    it('should return all components when entitlement versioning is not enabled in the org', async () => {
        entitlementSetting={enableEntitlementVersioning:undefined};
        let org = await createOrg();
        let records: AnyJson = {
            records: [
            ],
        };
        $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
            return Promise.resolve(records);
        };


        const virtualFs: VirtualDirectory[] = [
          {
            dirPath: '/metadata/entitlementProcesses',
            children: [
              {
                name: 'TestEntitlement.entitlementProcess-meta.xml',
                data: Buffer.from(TESTENTITLEMENT_NO_VERSION_NUMBER)
              }
            ]
          }
        ]

       
        
        // resolve components of a virtual tree
        const virtualTree = new VirtualTreeContainer(virtualFs);
        const componentSet = ComponentSet.fromSource({
            fsPaths: ['/metadata/entitlementProcesses'],
            tree: virtualTree,
        });
        let entitlementVersionFilter:EntitlementVersionFilter=new EntitlementVersionFilter();
        let modifiedComponentSet = await entitlementVersionFilter.apply(org,componentSet,new ConsoleLogger());
        
        let sourceComponents = modifiedComponentSet.getSourceComponents().toArray();
        expect(sourceComponents.find((element)=>element.name==`TestEntitlement`)).toBeDefined();




    });

    it('should return the same components when unable to fetch entitlement settings', async () => {
        entitlementSetting=undefined;
        let org = await createOrg();
        let records: AnyJson = {
            records: [
            ],
        };
        $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
            return Promise.resolve(records);
        };


        const virtualFs: VirtualDirectory[] = [
          {
            dirPath: '/metadata/entitlementProcesses',
            children: [
              {
                name: 'TestEntitlement.entitlementProcess-meta.xml',
                data: Buffer.from(TESTENTITLEMENT_NO_VERSION_NUMBER)
              }
            ]
          }
        ]

       
        
        // resolve components of a virtual tree
        const virtualTree = new VirtualTreeContainer(virtualFs);
        const componentSet = ComponentSet.fromSource({
            fsPaths: ['/metadata/entitlementProcesses'],
            tree: virtualTree,
        });
        let entitlementVersionFilter:EntitlementVersionFilter=new EntitlementVersionFilter();
        let modifiedComponentSet = await entitlementVersionFilter.apply(org,componentSet,new ConsoleLogger());
        
        let sourceComponents = modifiedComponentSet.getSourceComponents().toArray();
        expect(sourceComponents.find((element)=>element.name==`TestEntitlement`)).toBeDefined();




    });

});


const TESTENTITLEMENT_1=`<?xml version="1.0" encoding="UTF-8"?>
<EntitlementProcess xmlns="http://soap.sforce.com/2006/04/metadata">
    <SObjectType>Case</SObjectType>
    <active>true</active>
    <description>SLA Management of Case Resolution Time for AdCreation HK queue</description>
    <entryStartDateField>Case.CreatedDate</entryStartDateField>
    <exitCriteriaFilterItems>
        <field>Case.IsClosed</field>
        <operation>equals</operation>
        <value>true</value>
    </exitCriteriaFilterItems>
    <isVersionDefault>true</isVersionDefault>
    <milestones>
        <milestoneName>First Response to Customer</milestoneName>
        <minutesToComplete>999999</minutesToComplete>
        <useCriteriaStartTime>false</useCriteriaStartTime>
    </milestones>
    <milestones>
        <milestoneCriteriaFilterItems>
            <field>Case.Status</field>
            <operation>equals</operation>
            <value>New, Open, On Hold</value>
        </milestoneCriteriaFilterItems>
        <milestoneCriteriaFilterItems>
            <field>Case.Type</field>
            <operation>equals</operation>
            <value>Hirer, Candidate, Internal, Partner</value>
        </milestoneCriteriaFilterItems>
        <milestoneCriteriaFilterItems>
            <field>Case.Priority</field>
            <operation>equals</operation>
            <value>Urgent, Normal</value>
        </milestoneCriteriaFilterItems>
        <milestoneName>Case Resolution Time</milestoneName>
        <minutesToComplete>960</minutesToComplete>
        <timeTriggers>
            <actions>
                <name>Update_SLA_Breached_to_True</name>
                <type>FieldUpdate</type>
            </actions>
            <timeLength>0</timeLength>
            <workflowTimeTriggerUnit>Minutes</workflowTimeTriggerUnit>
        </timeTriggers>
        <useCriteriaStartTime>false</useCriteriaStartTime>
    </milestones>
    <name>TestEntitlement1</name>
    <versionMaster>5522O000000LlFu</versionMaster>
    <versionNumber>1</versionNumber>
</EntitlementProcess>
`

const TESTENTITLEMENT_2=`<?xml version="1.0" encoding="UTF-8"?>
<EntitlementProcess xmlns="http://soap.sforce.com/2006/04/metadata">
    <SObjectType>Case</SObjectType>
    <active>true</active>
    <description>SLA Management of Case Resolution Time for AdCreation HK queue</description>
    <entryStartDateField>Case.CreatedDate</entryStartDateField>
    <exitCriteriaFilterItems>
        <field>Case.IsClosed</field>
        <operation>equals</operation>
        <value>true</value>
    </exitCriteriaFilterItems>
    <isVersionDefault>true</isVersionDefault>
    <milestones>
        <milestoneName>First Response to Customer</milestoneName>
        <minutesToComplete>999999</minutesToComplete>
        <useCriteriaStartTime>false</useCriteriaStartTime>
    </milestones>
    <milestones>
        <milestoneCriteriaFilterItems>
            <field>Case.Status</field>
            <operation>equals</operation>
            <value>New, Open, On Hold</value>
        </milestoneCriteriaFilterItems>
        <milestoneCriteriaFilterItems>
            <field>Case.Type</field>
            <operation>equals</operation>
            <value>Hirer, Candidate, Internal, Partner</value>
        </milestoneCriteriaFilterItems>
        <milestoneCriteriaFilterItems>
            <field>Case.Priority</field>
            <operation>equals</operation>
            <value>Urgent, Normal</value>
        </milestoneCriteriaFilterItems>
        <milestoneName>Case Resolution Time</milestoneName>
        <minutesToComplete>960</minutesToComplete>
        <timeTriggers>
            <actions>
                <name>Update_SLA_Breached_to_True</name>
                <type>FieldUpdate</type>
            </actions>
            <timeLength>0</timeLength>
            <workflowTimeTriggerUnit>Minutes</workflowTimeTriggerUnit>
        </timeTriggers>
        <useCriteriaStartTime>false</useCriteriaStartTime>
    </milestones>
    <name>TestEntitlement2</name>
    <versionMaster>5522O000000LlFu</versionMaster>
    <versionNumber>1</versionNumber>
</EntitlementProcess>
`

const TESTENTITLEMENT_2_V2=`<?xml version="1.0" encoding="UTF-8"?>
<EntitlementProcess xmlns="http://soap.sforce.com/2006/04/metadata">
    <SObjectType>Case</SObjectType>
    <active>true</active>
    <description>SLA Management of Case Resolution Time for AdCreation HK queue</description>
    <entryStartDateField>Case.CreatedDate</entryStartDateField>
    <exitCriteriaFilterItems>
        <field>Case.IsClosed</field>
        <operation>equals</operation>
        <value>true</value>
    </exitCriteriaFilterItems>
    <isVersionDefault>true</isVersionDefault>
    <milestones>
        <milestoneName>First Response to Customer</milestoneName>
        <minutesToComplete>999999</minutesToComplete>
        <useCriteriaStartTime>false</useCriteriaStartTime>
    </milestones>
    <milestones>
        <milestoneCriteriaFilterItems>
            <field>Case.Status</field>
            <operation>equals</operation>
            <value>New, Open, On Hold</value>
        </milestoneCriteriaFilterItems>
        <milestoneCriteriaFilterItems>
            <field>Case.Type</field>
            <operation>equals</operation>
            <value>Hirer, Candidate, Internal, Partner</value>
        </milestoneCriteriaFilterItems>
        <milestoneCriteriaFilterItems>
            <field>Case.Priority</field>
            <operation>equals</operation>
            <value>Urgent, Normal</value>
        </milestoneCriteriaFilterItems>
        <milestoneName>Case Resolution Time</milestoneName>
        <minutesToComplete>960</minutesToComplete>
        <timeTriggers>
            <actions>
                <name>Update_SLA_Breached_to_True</name>
                <type>FieldUpdate</type>
            </actions>
            <timeLength>0</timeLength>
            <workflowTimeTriggerUnit>Minutes</workflowTimeTriggerUnit>
        </timeTriggers>
        <useCriteriaStartTime>false</useCriteriaStartTime>
    </milestones>
    <name>TestEntitlement2</name>
    <versionMaster>5522O000000LlFu</versionMaster>
    <versionNumber>2</versionNumber>
</EntitlementProcess>
`

const TESTENTITLEMENT_NO_VERSION_NUMBER=`<?xml version="1.0" encoding="UTF-8"?>
<EntitlementProcess xmlns="http://soap.sforce.com/2006/04/metadata">
    <SObjectType>Case</SObjectType>
    <active>true</active>
    <description>SLA Management of Case Resolution Time for AdCreation HK queue</description>
    <entryStartDateField>Case.CreatedDate</entryStartDateField>
    <exitCriteriaFilterItems>
        <field>Case.IsClosed</field>
        <operation>equals</operation>
        <value>true</value>
    </exitCriteriaFilterItems>
    <isVersionDefault>true</isVersionDefault>
    <milestones>
        <milestoneName>First Response to Customer</milestoneName>
        <minutesToComplete>999999</minutesToComplete>
        <useCriteriaStartTime>false</useCriteriaStartTime>
    </milestones>
    <milestones>
        <milestoneCriteriaFilterItems>
            <field>Case.Status</field>
            <operation>equals</operation>
            <value>New, Open, On Hold</value>
        </milestoneCriteriaFilterItems>
        <milestoneCriteriaFilterItems>
            <field>Case.Type</field>
            <operation>equals</operation>
            <value>Hirer, Candidate, Internal, Partner</value>
        </milestoneCriteriaFilterItems>
        <milestoneCriteriaFilterItems>
            <field>Case.Priority</field>
            <operation>equals</operation>
            <value>Urgent, Normal</value>
        </milestoneCriteriaFilterItems>
        <milestoneName>Case Resolution Time</milestoneName>
        <minutesToComplete>960</minutesToComplete>
        <timeTriggers>
            <actions>
                <name>Update_SLA_Breached_to_True</name>
                <type>FieldUpdate</type>
            </actions>
            <timeLength>0</timeLength>
            <workflowTimeTriggerUnit>Minutes</workflowTimeTriggerUnit>
        </timeTriggers>
        <useCriteriaStartTime>false</useCriteriaStartTime>
    </milestones>
    <name>TestEntitlement</name>
</EntitlementProcess>
`
