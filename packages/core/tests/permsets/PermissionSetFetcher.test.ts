import { expect } from '@jest/globals';
import PermissionSetFetcher from '../../src/permsets/PermissionSetFetcher';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { AnyJson } from '@salesforce/ts-types';
import { AuthInfo, Connection } from '@salesforce/core';
const $$ = testSetup();

describe('Retrieve assigned permsets provided username and a target org', () => {
    it('should return all the permsets for the provided username', async () => {
        const testData = new MockTestOrgData();

        $$.setConfigStubContents('AuthInfoConfig', {
            contents: await testData.getConfig(),
        });

        let records: AnyJson = {
            records: [
                {
                    attributes: {
                        type: 'PermissionSetAssignment',
                        url: '/services/data/v50.0/sobjects/PermissionSetAssignment/0Pa2s000000PC8fCAG',
                    },
                    Id: '0Pa2s000000PC8fCAG',
                    PermissionSet: {
                        attributes: {
                            type: 'PermissionSet',
                            url: '/services/data/v50.0/sobjects/PermissionSet/0PS2s000000bldoGAA',
                        },
                        Name: 'Salesforce_DX_Permissions',
                    },
                    Assignee: {
                        attributes: {
                            type: 'User',
                            url: '/services/data/v50.0/sobjects/User/0052s000000kuInAAI',
                        },
                        Username: testData.username,
                    },
                },
                {
                    attributes: {
                        type: 'PermissionSetAssignment',
                        url: '/services/data/v50.0/sobjects/PermissionSetAssignment/0Pa2s000000PC8aCAG',
                    },
                    Id: '0Pa2s000000PC8aCAG',
                    PermissionSet: {
                        attributes: {
                            type: 'PermissionSet',
                            url: '/services/data/v50.0/sobjects/PermissionSet/0PS6F000004MA6gWAG',
                        },
                        Name: 'X00ex00000018ozT_128_09_43_34_1',
                    },
                    Assignee: {
                        attributes: {
                            type: 'User',
                            url: '/services/data/v50.0/sobjects/User/0052s000000kuInAAI',
                        },
                        Username: testData.username,
                    },
                },
            ],
        };
        $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
            return Promise.resolve(records);
        };
        const connection: Connection = await Connection.create({
            authInfo: await AuthInfo.create({ username: testData.username }),
        });

        let permsetListImpl: PermissionSetFetcher = new PermissionSetFetcher(testData.username, connection);
        let permsetRecords = await permsetListImpl.fetchAllPermsetAssignment();
        expect(permsetRecords).toHaveLength(2);
    });

    it('should return an empty array, if no permsets are assigned', async () => {
        const testData = new MockTestOrgData();
        $$.setConfigStubContents('AuthInfoConfig', {
            contents: await testData.getConfig(),
        });

        let records: AnyJson = { records: [] };
        $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
            return Promise.resolve(records);
        };

        const connection: Connection = await Connection.create({
            authInfo: await AuthInfo.create({ username: testData.username }),
        });

        let permsetListImpl: PermissionSetFetcher = new PermissionSetFetcher(testData.username, connection);
        let permsetRecords = await permsetListImpl.fetchAllPermsetAssignment();
        expect(permsetRecords).toHaveLength(0);
    });

    it('should throw an error, if unable to query permsets', async () => {
        const testData = new MockTestOrgData();

        $$.setConfigStubContents('AuthInfoConfig', {
            contents: await testData.getConfig(),
        });

        let records: AnyJson = { records: [] };
        $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
            throw new Error('Unable to fetch records');
        };

        const connection: Connection = await Connection.create({
            authInfo: await AuthInfo.create({ username: testData.username }),
        });

        let permsetListImpl: PermissionSetFetcher = new PermissionSetFetcher(testData.username, connection);

        try {
            await permsetListImpl.fetchAllPermsetAssignment();
        } catch (error) {
            expect(error).toBeDefined();
        }
    }, 500000);
});
