import { jest, expect } from '@jest/globals';
import FTAnalyser from '../../../src/package/analyser/FTAnalyzer';
import SfpPackage, { PackageType } from '../../../src/package/SfpPackage';
const fs = require('fs-extra');
import { ComponentSet, SourceComponent, registry, VirtualDirectory } from '@salesforce/source-deploy-retrieve';
import { VoidLogger } from '@dxatscale/sfp-logger';

let isYamlFileFound: boolean = true;

describe('FT Analyzer', () => {
    beforeEach(() => {
        const fsReadMock = jest.spyOn(fs, 'readFileSync');
        fsReadMock.mockImplementationOnce(() => {
            return `
             Account:
                  - Name
                  - Phone
             Contact:
                 - Name
                 - Phone
          `;
        });
        const fsExistSyncMock = jest.spyOn(fs, 'existsSync');
        fsExistSyncMock.mockImplementationOnce(() => {
            return isYamlFileFound;
        });
    });

    it('Should not be enabled for data packages', async () => {
        let ftAnalyzer = new FTAnalyser();
        let sfpPackage: SfpPackage = {
            projectDirectory: process.cwd(),
            workingDirectory: 'force-app',
            mdapiDir: '',
            destructiveChangesPath: '',
            resolvedPackageDirectory: '',
            version: '',
            packageName: '',
            versionNumber: '',
            packageType: PackageType.Data,
            package_name: '',
            toJSON: function (): any {
                return '';
            },
        };
        expect(await ftAnalyzer.isEnabled(sfpPackage,new VoidLogger())).toBe(false);
    });

    it('Should  be enabled for source packages by default', async () => {
        let ftAnalyzer = new FTAnalyser();
        let sfpPackage: SfpPackage = {
            projectDirectory: '',
            workingDirectory: process.cwd(),
            mdapiDir: '',
            destructiveChangesPath: '',
            resolvedPackageDirectory: '',
            version: '',
            packageName: '',
            versionNumber: '',
            packageType: PackageType.Source,
            package_name: '',
            toJSON: function (): any {
                return '';
            },
        };
        expect(await ftAnalyzer.isEnabled(sfpPackage,new VoidLogger())).toBe(true);
    });

    it('Should be enabled for unlocked packages by default', async () => {
        let ftAnalyzer = new FTAnalyser();
        let sfpPackage: SfpPackage = {
            projectDirectory: process.cwd(),
            workingDirectory: 'force-app',
            mdapiDir: '',
            destructiveChangesPath: '',
            resolvedPackageDirectory: '',
            version: '',
            packageName: '',
            versionNumber: '',
            packageType: PackageType.Unlocked,
            package_name: '',
            toJSON: function (): any {
                return '';
            },
        };
        expect(await ftAnalyzer.isEnabled(sfpPackage,new VoidLogger())).toBe(true);
    });

    it(' When a yaml is provided and no additional fields, a sfpPackage with additional properties should be created', async () => {

       isYamlFileFound = true;

        const set = new ComponentSet();
        set.add({ fullName: 'MyClass', type: 'ApexClass' });
        set.add({ fullName: 'MyLayout', type: 'Layout' });

        const componentSetMock = jest.spyOn(ComponentSet, 'fromSource');
        componentSetMock.mockImplementationOnce(() => {
            return set;
        });

        let ftAnalyzer = new FTAnalyser();
        let sfpPackage: SfpPackage = {
            projectDirectory: '',
            packageDirectory: 'force-app',
            workingDirectory: process.cwd(),
            mdapiDir: '',
            destructiveChangesPath: '',
            resolvedPackageDirectory: '',
            version: '',
            packageName: '',
            versionNumber: '',
            packageType: PackageType.Unlocked,
            package_name: '',
            toJSON: function (): any {
                return '';
            },
        };
        sfpPackage = await ftAnalyzer.analyze(sfpPackage,set,new VoidLogger());
        expect(sfpPackage['isFTFieldFound']).toBe(true);
        expect(sfpPackage['ftFields']).toBeDefined();
        let ftFields = sfpPackage['ftFields'];
        expect(ftFields.Account).toStrictEqual(['Name', 'Phone']);
        expect(ftFields.Contact).toStrictEqual(['Name', 'Phone']);
    });

    it(' When a yaml is provided, package has no feed enabled fields, a sfpPackage with combined additional properties should be created', async () => {

       isYamlFileFound = true;

        const set = new ComponentSet();
        set.add({ fullName: 'MyClass', type: 'ApexClass' });
        set.add({ fullName: 'MyLayout', type: 'Layout' });

        const virtualFs: VirtualDirectory[] = [
            {
                dirPath: '/main/default/object/Test__c/fields',
                children: [
                    {
                        name: 'AccountManager__c.field-meta.xml',
                        data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
                <CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
                    <fullName>AccountManager__c</fullName>
                    <externalId>false</externalId>
                    <formula>Account.AccountOwner__c</formula>
                    <formulaTreatBlanksAs>BlankAsZero</formulaTreatBlanksAs>
                    <label>Account Manager</label>
                    <required>false</required>
                    <trackHistory>false</trackHistory>
                    <trackFeedHistory>true</trackFeedHistory>
                    <trackTrending>false</trackTrending>
                    <type>Text</type>
                    <unique>false</unique>
                </CustomField>`),
                    },
                ],
            },
        ];
        const customField = SourceComponent.createVirtualComponent(
            {
                name: 'AccountManager__c',
                type: registry.types.customobject.children.types.customfield,
                xml: '/main/default/object/Test__c/fields/AccountManager__c.field-meta.xml',
                parent: SourceComponent.createVirtualComponent({
                    name: 'Test__c',
                    type: registry.types.customobject,
                    xml: '/main/default/object/Test__c.object-meta.xml',
                }),
            },
            virtualFs
        );

        set.add(customField);

        const componentSetMock = jest.spyOn(ComponentSet, 'fromSource');
        componentSetMock.mockImplementationOnce(() => {
            return set;
        });

        let ftAnalyzer = new FTAnalyser();
        let sfpPackage: SfpPackage = {
            projectDirectory: '',
            packageDirectory: 'force-app',
            workingDirectory: process.cwd(),
            mdapiDir: '',
            destructiveChangesPath: '',
            resolvedPackageDirectory: '',
            version: '',
            packageName: '',
            versionNumber: '',
            packageType: PackageType.Unlocked,
            package_name: '',
            toJSON: function (): any {
                return '';
            },
        };
        sfpPackage = await ftAnalyzer.analyze(sfpPackage,set,new VoidLogger());
        expect(sfpPackage['isFTFieldFound']).toBe(true);
        expect(sfpPackage['ftFields']).toBeDefined();
        let ftFields = sfpPackage['ftFields'];
        expect(ftFields.Account).toStrictEqual(['Name', 'Phone']);
        expect(ftFields.Contact).toStrictEqual(['Name', 'Phone']);
        expect(ftFields.Test__c).toStrictEqual(['AccountManager__c']);
    });

    it(' When a yaml is provided, package has no feed enabled fields, a sfpPackage with combined additional properties should be created', async () => {


       isYamlFileFound = true;

        const set = new ComponentSet();
        set.add({ fullName: 'MyClass', type: 'ApexClass' });
        set.add({ fullName: 'MyLayout', type: 'Layout' });

        const virtualFs: VirtualDirectory[] = [
            {
                dirPath: '/main/default/object/Test__c/fields',
                children: [
                    {
                        name: 'AccountManager__c.field-meta.xml',
                        data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
              <CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
                  <fullName>AccountManager__c</fullName>
                  <externalId>false</externalId>
                  <formula>Account.AccountOwner__c</formula>
                  <formulaTreatBlanksAs>BlankAsZero</formulaTreatBlanksAs>
                  <label>Account Manager</label>
                  <required>false</required>
                  <trackHistory>false</trackHistory>
                  <trackFeedHistory>false</trackFeedHistory>
                  <trackTrending>false</trackTrending>
                  <type>Text</type>
                  <unique>false</unique>
              </CustomField>`),
                    },
                ],
            },
        ];
        const customField = SourceComponent.createVirtualComponent(
            {
                name: 'AccountManager__c',
                type: registry.types.customobject.children.types.customfield,
                xml: '/main/default/object/Test__c/fields/AccountManager__c.field-meta.xml',
                parent: SourceComponent.createVirtualComponent({
                    name: 'Test__c',
                    type: registry.types.customobject,
                    xml: '/main/default/object/Test__c.object-meta.xml',
                }),
            },
            virtualFs
        );

        set.add(customField);

        const componentSetMock = jest.spyOn(ComponentSet, 'fromSource');
        componentSetMock.mockImplementationOnce(() => {
            return set;
        });

        let ftAnalyzer = new FTAnalyser();
        let sfpPackage: SfpPackage = {
            projectDirectory: '',
            packageDirectory: 'force-app',
            workingDirectory: process.cwd(),
            mdapiDir: '',
            destructiveChangesPath: '',
            resolvedPackageDirectory: '',
            version: '',
            packageName: '',
            versionNumber: '',
            packageType: PackageType.Unlocked,
            package_name: '',
            toJSON: function (): any {
                return '';
            },
        };
        sfpPackage = await ftAnalyzer.analyze(sfpPackage,set,new VoidLogger());
        expect(sfpPackage['isFTFieldFound']).toBe(true);
        expect(sfpPackage['ftFields']).toBeDefined();
        let ftFields = sfpPackage['ftFields'];
        expect(ftFields.Account).toStrictEqual(['Name', 'Phone']);
        expect(ftFields.Contact).toStrictEqual(['Name', 'Phone']);
        expect(ftFields).not.toHaveProperty('Test__c');
    });

    it(' When no yaml is provided, package has feed enabled fields, a sfpPackage with combined additional properties should be created', async () => {


        isYamlFileFound = false;

        const set = new ComponentSet();
        set.add({ fullName: 'MyClass', type: 'ApexClass' });
        set.add({ fullName: 'MyLayout', type: 'Layout' });

        const virtualFs: VirtualDirectory[] = [
            {
                dirPath: '/main/default/object/Test__c/fields',
                children: [
                    {
                        name: 'AccountManager__c.field-meta.xml',
                        data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
            <CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
                <fullName>AccountManager__c</fullName>
                <externalId>false</externalId>
                <formula>Account.AccountOwner__c</formula>
                <formulaTreatBlanksAs>BlankAsZero</formulaTreatBlanksAs>
                <label>Account Manager</label>
                <required>false</required>
                <trackHistory>false</trackHistory>
                <trackFeedHistory>true</trackFeedHistory>
                <trackTrending>false</trackTrending>
                <type>Text</type>
                <unique>false</unique>
            </CustomField>`),
                    },
                ],
            },
        ];
        const customField = SourceComponent.createVirtualComponent(
            {
                name: 'AccountManager__c',
                type: registry.types.customobject.children.types.customfield,
                xml: '/main/default/object/Test__c/fields/AccountManager__c.field-meta.xml',
                parent: SourceComponent.createVirtualComponent({
                    name: 'Test__c',
                    type: registry.types.customobject,
                    xml: '/main/default/object/Test__c.object-meta.xml',
                }),
            },
            virtualFs
        );

        set.add(customField);

        const componentSetMock = jest.spyOn(ComponentSet, 'fromSource');
        componentSetMock.mockImplementationOnce(() => {
            return set;
        });

        let ftAnalyzer = new FTAnalyser();
        let sfpPackage: SfpPackage = {
            projectDirectory: '',
            packageDirectory: 'force-app',
            workingDirectory: process.cwd(),
            mdapiDir: '',
            destructiveChangesPath: '',
            resolvedPackageDirectory: '',
            version: '',
            packageName: '',
            versionNumber: '',
            packageType: PackageType.Unlocked,
            package_name: '',
            toJSON: function (): any {
                return '';
            },
        };
        sfpPackage = await ftAnalyzer.analyze(sfpPackage,set,new VoidLogger());
        expect(sfpPackage['isFTFieldFound']).toBe(true);
        expect(sfpPackage['ftFields']).toBeDefined();
        let ftFields = sfpPackage['ftFields'];
        expect(ftFields.Test__c).toStrictEqual(['AccountManager__c']);
    });
});
