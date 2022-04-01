import { expect } from '@jest/globals';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { VoidLogger } from '../../src/logger/SFPLogger';
import artifactMetadata from '../../src/PackageMetadata';
import { AnyJson, ensureJsonMap, JsonMap, ensureString } from '@salesforce/ts-types';
import SFPOrg from '../../src/org/SFPOrg';
import { assert } from 'console';

const $$ = testSetup();
const createOrg = async () => {
    const testData = new MockTestOrgData();

    $$.setConfigStubContents('AuthInfoConfig', {
        contents: await testData.getConfig(),
    });

    return await SFPOrg.create({ aliasOrUsername: testData.username });
};

describe('Fetch a list of sfpowerscripts artifacts from an org', () => {
    it('Return a  blank list of sfpowerscripts artifact, if there are no previously installed artifacts ', async () => {
        let org = await createOrg();

        let records: AnyJson = { records: [] };
        $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
            return Promise.resolve(records);
        };

        let artifacts = await org.getInstalledArtifacts();
        expect(artifacts).toEqual([]);
    });

    it('Return a list of sfpowerscripts artifact, if there are previously installed artifacts ', async () => {
        let org = await createOrg();

        let records: AnyJson = {
            records: [
                {
                    Id: 'a0zR0000003F1FuIAK',
                    Name: 'sfpowerscripts-package',
                    CommitId__c: '0a516404aa92f02866f9d2725bda5b1b3f23547e',
                    Version__c: '1.0.0.NEXT',
                    Tag__c: 'undefined',
                },
            ],
        };

        $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
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

    it('When unable to fetch, it should throw an error', async () => {
        let org = await createOrg();

        $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
            return Promise.reject('Failed');
        };

        expect(org.getInstalledArtifacts()).resolves.toStrictEqual([]);
    });
});

describe('Update a sfpowerscripts artifact to an org', () => {
    it('Update a sfpowerscripts artifact, installing it the first time', async () => {
        let org = await createOrg();

        let records: AnyJson = {
            records: [],
        };

        let pushResult: AnyJson = {
            id: 'a0zR0000003F1FuIAK',
            success: true,
            errors: [],
        };

        $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
            const _request: JsonMap = ensureJsonMap(request);
            if (request && ensureString(_request.method) == `GET`) return Promise.resolve(records);
            else return Promise.resolve(pushResult);
        };

        let artifactMetadata: artifactMetadata = {
            package_name: 'core',
            repository_url: 'https://example.com',
            package_version_number: '1.0.0.NEXT',
            sourceVersion: '3232x232xc3e',
        };

        let result = await org.updateArtifactInOrg(new VoidLogger(), artifactMetadata);

        expect(result).toEqual(pushResult.id);
    });

    it('Update a sfpowerscripts artifact, installing a newer version of it', async () => {
        let org = await createOrg();

        let records: AnyJson = {
            records: [
                {
                    attributes: {
                        type: 'SfpowerscriptsArtifact2__c',
                        url: '/services/data/v50.0/sobjects/Sfpowerscriptspackage__c/a0zR0000003F1FuIAK',
                    },
                    Id: 'a0zR0000003F1FuIAK',
                    Name: 'core',
                    CommitId__c: '0a516404aa92f02866f9d2725bda5b1b3f23547e',
                    Version__c: '1.0.0.NEXT',
                    Tag__c: 'undefined',
                },
            ],
        };

        let pushResult: AnyJson = {
            id: 'a0zR0000003F1FuIAK',
            success: true,
            errors: [],
        };

        $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
            const _request: JsonMap = ensureJsonMap(request);
            if (request && ensureString(_request.method) == `GET`) return Promise.resolve(records);
            else return Promise.resolve(pushResult);
        };

        let artifactMetadata: artifactMetadata = {
            package_name: 'core',
            repository_url: 'https://example.com',
            package_version_number: '1.0.0.NEXT',
            sourceVersion: '3232x232xc3e',
        };

        let result = await org.updateArtifactInOrg(new VoidLogger(), artifactMetadata);

        expect(result).toEqual(pushResult.id);
    });

    it('Update a sfpowerscripts artifact and resulting an error,should throw an exception', async () => {
        let org = await createOrg();

        let records: AnyJson = {
            records: [
                {
                    attributes: {
                        type: 'SfpowerscriptsArtifact2__c',
                        url: '/services/data/v50.0/sobjects/Sfpowerscriptspackage__c/a0zR0000003F1FuIAK',
                    },
                    Id: 'a0zR0000003F1FuIAK',
                    Name: 'core',
                    CommitId__c: '0a516404aa92f02866f9d2725bda5b1b3f23547e',
                    Version__c: '1.0.0.NEXT',
                    Tag__c: 'undefined',
                },
            ],
        };

        let pushResult: AnyJson = {
            success: false,
            errors: [],
        };

        $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
            const _request: JsonMap = ensureJsonMap(request);
            if (request && ensureString(_request.method) == `GET`) return Promise.resolve(records);
            else return Promise.resolve(pushResult);
        };

        let artifactMetadata: artifactMetadata = {
            package_name: 'core',
            repository_url: 'https://example.com',
            package_version_number: '1.0.0.NEXT',
            sourceVersion: '3232x232xc3e',
        };

        try {
            await org.updateArtifactInOrg(new VoidLogger(), artifactMetadata);
        } catch (error) {
            expect(error.message).toContain('Aborted');
        }
    });
});
