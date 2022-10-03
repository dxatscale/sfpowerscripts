import fs from 'fs-extra';
import { jest, expect } from '@jest/globals';
import PackageManifest from '../../src/package/components/PackageManifest';

describe('Given a mdapi directory that contains manifest file', () => {
    beforeEach(() => {
        const fsextraMock = jest.spyOn(fs, 'readFileSync');
        fsextraMock.mockImplementation((path: any, options: string | { encoding?: string; flag?: string }) => {
            return packageManifestXML;
        });
    });

    it('should return the manifest in json format', async () => {
        const packageManifest: PackageManifest = await PackageManifest.create('mdapi');
        expect(packageManifest.manifestJson).toStrictEqual(packageManifestJSON);
    });

    it('should return the manifest in xml format', async () => {
        const packageManifest: PackageManifest = await PackageManifest.create('mdapi');
        expect(packageManifest.manifestXml).toStrictEqual(packageManifestXML);
    });

    it('should return true if there is apex', async () => {
        const packageManifest: PackageManifest = await PackageManifest.create('mdapi');
        expect(packageManifest.isApexInPackage()).toBe(true);
    });

    it('should return undefined if there are no triggers', async () => {
        const packageManifest: PackageManifest = await PackageManifest.create('mdapi');
        expect(packageManifest.fetchTriggers()).toBe(undefined);
    });

    it('should return false if there are no profiles', async () => {
        const packageManifest: PackageManifest = await PackageManifest.create('mdapi');
        expect(packageManifest.isProfilesInPackage()).toBe(false);
    });

    it('should return false if there are no permission set groups', async () => {
        const packageManifest: PackageManifest = await PackageManifest.create('mdapi');
        expect(packageManifest.isPermissionSetGroupsFoundInPackage()).toBe(false);
    });
});

describe('Given a list of components', () => {
    it('should create a package manifest from scratch', () => {
        const packageManifest: PackageManifest = PackageManifest.createFromScratch(components, '50.0');

        expect(packageManifest).toBeInstanceOf(PackageManifest);
        expect(packageManifest.manifestJson).toEqual(packageManifestJSON_b);
        expect(packageManifest.manifestXml).toEqual(packageManifestXML_b);
    });

    it('should fetch triggers', () => {
        const packageManifest: PackageManifest = PackageManifest.createFromScratch(components, '50.0');

        expect(packageManifest.fetchTriggers()).toEqual(['ContractTrigger']);
    });

    it('should return true if there are permission set groups ', () => {
        const packageManifest: PackageManifest = PackageManifest.createFromScratch(components, '50.0');

        expect(packageManifest.isPermissionSetGroupsFoundInPackage()).toBe(true);
    });

    it('should return true if there are profiles', () => {
        const packageManifest: PackageManifest = PackageManifest.createFromScratch(components, '50.0');

        expect(packageManifest.isProfilesInPackage()).toBe(true);
    });

    it('should return true if there are types supported by profiles', async () => {
        const packageManifest: PackageManifest = PackageManifest.createFromScratch(components, '50.0');
        expect(packageManifest.isPayLoadContainTypesSupportedByProfiles()).toBe(true);
    });

    it('should return true if there are types other than', async () => {
        const packageManifest: PackageManifest = PackageManifest.createFromScratch(components, '50.0');
        expect(packageManifest.isPayloadContainTypesOtherThan('Profile')).toBe(true);
    });
});

describe('Given a manifest json payload', () => {
    it('should create an instance of PackageManifest', async () => {
        const packageManifest: PackageManifest = await PackageManifest.createWithJSONManifest(packageManifestJSON);

        expect(packageManifest).toBeInstanceOf(PackageManifest);
        expect(packageManifest.manifestJson).toEqual(packageManifestJSON);
        expect(packageManifest.manifestXml).toEqual(packageManifestXML);
    });
});

const components: { fullName: string; type: string }[] = [
    {
        fullName: 'ContractService',
        type: 'ApexClass',
    },
    {
        fullName: 'ContractTrigger',
        type: 'ApexTrigger',
    },
    {
        fullName: 'ContractVariables__mdt-ContractVariables Layout',
        type: 'Layout',
    },
    {
        fullName: 'Contract.Reason__c',
        type: 'CustomField',
    },
    {
        fullName: 'Contract.ContractTerm__c',
        type: 'CustomField',
    },
    {
        fullName: 'Contract',
        type: 'CustomObject',
    },
    {
        fullName: 'ContractPermissionSetGroup',
        type: 'PermissionSetGroup',
    },
    {
        fullName: 'Contractor',
        type: 'Profile',
    },
];

const packageManifestJSON_b = {
    Package: {
        $: {
            xmlns: 'http://soap.sforce.com/2006/04/metadata',
        },
        types: [
            {
                name: 'ApexClass',
                members: ['ContractService'],
            },
            {
                name: 'ApexTrigger',
                members: ['ContractTrigger'],
            },
            {
                name: 'Layout',
                members: ['ContractVariables__mdt-ContractVariables Layout'],
            },
            {
                name: 'CustomField',
                members: ['Contract.Reason__c', 'Contract.ContractTerm__c'],
            },
            {
                name: 'CustomObject',
                members: ['Contract'],
            },
            {
                name: 'PermissionSetGroup',
                members: ['ContractPermissionSetGroup'],
            },
            {
                name: 'Profile',
                members: ['Contractor'],
            },
        ],
        version: '50.0',
    },
};

const packageManifestXML_b: string = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <name>ApexClass</name>
    <members>ContractService</members>
  </types>
  <types>
    <name>ApexTrigger</name>
    <members>ContractTrigger</members>
  </types>
  <types>
    <name>Layout</name>
    <members>ContractVariables__mdt-ContractVariables Layout</members>
  </types>
  <types>
    <name>CustomField</name>
    <members>Contract.Reason__c</members>
    <members>Contract.ContractTerm__c</members>
  </types>
  <types>
    <name>CustomObject</name>
    <members>Contract</members>
  </types>
  <types>
    <name>PermissionSetGroup</name>
    <members>ContractPermissionSetGroup</members>
  </types>
  <types>
    <name>Profile</name>
    <members>Contractor</members>
  </types>
  <version>50.0</version>
</Package>`;

const packageManifestJSON = {
    Package: {
        $: { xmlns: 'http://soap.sforce.com/2006/04/metadata' },
        types: [
            {
                name: 'AuraDefinitionBundle',
                members: ['openRecordAction', 'selectObject'],
            },
            {
                name: 'ApexClass',
                members: [
                    'CustomerServices',
                    'CustomerServicesTest',
                    'MarketServices',
                    'MarketServicesTest',
                    'TestDataFactory',
                ],
            },
            {
                name: 'CustomMetadata',
                members: ['Customer_Fields.Contact_Customer_Fields', 'Customer_Fields.Lead_Customer_Fields'],
            },
            {
                name: 'Layout',
                members: 'Customer_Fields__mdt-Customer Fields Layout',
            },
            { name: 'LightningComponentBundle', members: ['errorPanel', 'ldsUtils'] },
            {
                name: 'LightningMessageChannel',
                members: ['Flow_Status_Change', 'Tile_Selection'],
            },
            { name: 'CustomObject', members: 'Customer_Fields__mdt' },
            {
                name: 'CustomField',
                members: [
                    'Customer_Fields__mdt.Customer_City__c',
                    'Customer_Fields__mdt.Customer_Draft_Status_Values__c',
                    'Customer_Fields__mdt.Customer_Email__c',
                    'Customer_Fields__mdt.Customer_Name__c',
                    'Customer_Fields__mdt.Customer_Reservation_Status_Value__c',
                    'Customer_Fields__mdt.Customer_State__c',
                    'Customer_Fields__mdt.Customer_Status__c',
                    'Customer_Fields__mdt.Sobject_Type__c',
                ],
            },
        ],
        version: '50.0',
    },
};

const packageManifestXML: string = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <name>AuraDefinitionBundle</name>
    <members>openRecordAction</members>
    <members>selectObject</members>
  </types>
  <types>
    <name>ApexClass</name>
    <members>CustomerServices</members>
    <members>CustomerServicesTest</members>
    <members>MarketServices</members>
    <members>MarketServicesTest</members>
    <members>TestDataFactory</members>
  </types>
  <types>
    <name>CustomMetadata</name>
    <members>Customer_Fields.Contact_Customer_Fields</members>
    <members>Customer_Fields.Lead_Customer_Fields</members>
  </types>
  <types>
    <name>Layout</name>
    <members>Customer_Fields__mdt-Customer Fields Layout</members>
  </types>
  <types>
    <name>LightningComponentBundle</name>
    <members>errorPanel</members>
    <members>ldsUtils</members>
  </types>
  <types>
    <name>LightningMessageChannel</name>
    <members>Flow_Status_Change</members>
    <members>Tile_Selection</members>
  </types>
  <types>
    <name>CustomObject</name>
    <members>Customer_Fields__mdt</members>
  </types>
  <types>
    <name>CustomField</name>
    <members>Customer_Fields__mdt.Customer_City__c</members>
    <members>Customer_Fields__mdt.Customer_Draft_Status_Values__c</members>
    <members>Customer_Fields__mdt.Customer_Email__c</members>
    <members>Customer_Fields__mdt.Customer_Name__c</members>
    <members>Customer_Fields__mdt.Customer_Reservation_Status_Value__c</members>
    <members>Customer_Fields__mdt.Customer_State__c</members>
    <members>Customer_Fields__mdt.Customer_Status__c</members>
    <members>Customer_Fields__mdt.Sobject_Type__c</members>
  </types>
  <version>50.0</version>
</Package>`;
