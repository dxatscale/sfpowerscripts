import { expect } from '@jest/globals';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { ConsoleLogger, VoidLogger } from '@dxatscale/sfp-logger';
import { AnyJson, ensureJsonMap, JsonMap, ensureString } from '@salesforce/ts-types';
import SFPOrg from '../../src/org/SFPOrg';
import SfpPackage from '../../src/package/SfpPackage';


const $$ = testSetup();
const createOrg = async () => {

    const testData = new MockTestOrgData();
    await $$.stubAuths(testData);
    $$.setConfigStubContents('AuthInfoConfig', {
        contents: await testData.getConfig(),
    });

 
    return await SFPOrg.create({ aliasOrUsername: testData.username });
};

describe('Fetch a list of sfpowerscripts artifacts from an org', () => {
    it('Return a  blank list of sfpowerscripts artifact, if there are no previously installed artifacts ', async () => {
        let org = await createOrg();

        let records = { records: [] };
        $$.fakeConnectionRequest = (request) => {
            return Promise.resolve(records);
        };

        let artifacts = await org.getInstalledArtifacts();
        expect(artifacts).toEqual([]);
    });

    it('Return a list of sfpowerscripts artifact, if there are previously installed artifacts ', async () => {
        let org = await createOrg();

        let records = { records:[
            {
                Id: 'a0zR0000003F1FuIAK',
                Name: 'sfpowerscripts-package',
                CommitId__c: '0a516404aa92f02866f9d2725bda5b1b3f23547e',
                Version__c: '1.0.0.NEXT',
                Tag__c: 'undefined',
            },
        ]};

        $$.fakeConnectionRequest = (request) => {
            return Promise.resolve(records);
        };

        let artifacts = await org.getInstalledArtifacts();
        let expectedpackage = {
            Id: 'a0zR0000003F1FuIAK',
            Name: 'sfpowerscripts-package',
            CommitId__c: '0a516404aa92f02866f9d2725bda5b1b3f23547e',
            Version__c: '1.0.0.NEXT',
            Tag__c: 'undefined',
        };
        expect(artifacts).toEqual([expectedpackage]);
    });

    it('When unable to fetch, it should return a blank list', async () => {
        let org = await createOrg();

        $$.fakeConnectionRequest = (request) => {
            return Promise.reject('Failed');
        };

       let artifacts = await org.getInstalledArtifacts();
       expect(artifacts).toEqual([]);
    },45000);
});

describe('Update a sfpowerscripts artifact to an org', () => {
    it('Update a sfpowerscripts artifact, installing it the first time', async () => {
        let org = await createOrg();

        let records = { records: [] };

        let pushResult = {
            id: 'a0zR0000003F1FuIAK',
            success: true,
            errors: [],
        };

        $$.fakeConnectionRequest = (request) => {
            const _request = ensureJsonMap(request);
            if (_request.method == `GET`) return Promise.resolve(records);
            else return Promise.resolve(pushResult);
        };

        let sfpPackage: SfpPackage = {
            package_name: 'core',
            repository_url: 'https://example.com',
            package_version_number: '1.0.0.NEXT',
            sourceVersion: '3232x232xc3e',
            projectDirectory: '',
            workingDirectory: '',
            mdapiDir: '',
            destructiveChangesPath: '',
            resolvedPackageDirectory: '',
            version: '',
            packageName: '',
            versionNumber: '',
            packageType: '',
            toJSON: function () {
                throw new Error('Function not implemented.');
            },
        };

        let result = await org.updateArtifactInOrg(new VoidLogger(), sfpPackage);
        expect(result).toEqual(pushResult.id);
    });

    it('Update a sfpowerscripts artifact, installing a newer version of it', async () => {
        let org = await createOrg();

        let records = { records : [
            {
                Id: 'a0zR0000003F1FuIAK',
                Name: 'core',
                CommitId__c: '0a516404aa92f02866f9d2725bda5b1b3f23547e',
                Version__c: '1.0.0.NEXT',
                Tag__c: 'undefined',
            }
        ]};

        let pushResult: AnyJson = {
            id: 'a0zR0000003F1FuIAK',
            success: true,
            errors: [],
        };

        $$.fakeConnectionRequest = (request) => {
            const _request: JsonMap = ensureJsonMap(request);
            if (request && ensureString(_request.method) == `GET`) return Promise.resolve(records);
            else return Promise.resolve(pushResult);
        };

        let sfpPackage: SfpPackage = {
            package_name: 'core',
            repository_url: 'https://example.com',
            package_version_number: '1.0.0.NEXT',
            sourceVersion: '3232x232xc3e',
            projectDirectory: '',
            workingDirectory: '',
            mdapiDir: '',
            destructiveChangesPath: '',
            resolvedPackageDirectory: '',
            version: '',
            packageName: '',
            versionNumber: '',
            packageType: '',
            toJSON: function (): any {
                throw new Error('Function not implemented.');
            },
        };

        let result = await org.updateArtifactInOrg(new ConsoleLogger(), sfpPackage);

        expect(result).toEqual(pushResult.id);
    });

    it('Update a sfpowerscripts artifact and resulting an error,should throw an exception', async () => {
        let org = await createOrg();

        let records={ records : [
            {
                Id: 'a0zR0000003F1FuIAK',
                Name: 'core',
                CommitId__c: '0a516404aa92f02866f9d2725bda5b1b3f23547e',
                Version__c: '1.0.0.NEXT',
                Tag__c: 'undefined',
            },
        ]};

        let pushResult: AnyJson = {
            success: false,
            errors: [],
        };

        $$.fakeConnectionRequest = (request) => {
            const _request: JsonMap = ensureJsonMap(request);
            if (request && ensureString(_request.method) == `GET`) return Promise.resolve(records);
            else return Promise.resolve(pushResult);
        };

        let sfpPackage: SfpPackage = {
            package_name: 'core',
            repository_url: 'https://example.com',
            package_version_number: '1.0.0.NEXT',
            sourceVersion: '3232x232xc3e',
            projectDirectory: '',
            workingDirectory: '',
            mdapiDir: '',
            destructiveChangesPath: '',
            resolvedPackageDirectory: '',
            version: '',
            packageName: '',
            versionNumber: '',
            packageType: '',
            toJSON: function () {
                throw new Error('Function not implemented.');
            },
        };

        try {
            await org.updateArtifactInOrg(new VoidLogger(), sfpPackage);
        } catch (error) {
            expect(error.message).toContain('Aborted');
        }
    });
});
