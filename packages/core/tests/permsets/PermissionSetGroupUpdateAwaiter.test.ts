import { MockTestOrgData, TestContext } from '@salesforce/core/lib/testSetup';
import { AuthInfo, Connection, OrgConfigProperties } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
const $$ = new TestContext();
import PermissionSetGroupUpdateAwaiter from '../../src/permsets/PermissionSetGroupUpdateAwaiter';
import { expect } from '@jest/globals';

describe('Await till permissionsets groups are updated', () => {
    it('should return if all permsets groups are updated', async () => {
        const testData = new MockTestOrgData();

        await $$.stubConfig({ [OrgConfigProperties.TARGET_ORG]: testData.username });
        await $$.stubAuths(testData);
        $$.setConfigStubContents('AuthInfoConfig', {
            contents: await testData.getConfig(),
        });

        let records: AnyJson = {
            records: [],
        };
        $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
            return Promise.resolve(records);
        };

        const connection: Connection = await Connection.create({
            authInfo: await AuthInfo.create({ username: testData.username }),
        });

        let permissionSetGroupUpdateAwaiter: PermissionSetGroupUpdateAwaiter = new PermissionSetGroupUpdateAwaiter(
            connection,
            null
        );
        await expect(permissionSetGroupUpdateAwaiter.waitTillAllPermissionSetGroupIsUpdated()).resolves.toBeUndefined();
    });
});
