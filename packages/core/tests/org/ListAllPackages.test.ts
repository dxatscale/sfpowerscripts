import { expect } from '@jest/globals';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { AnyJson } from '@salesforce/ts-types';
import SFPOrg from '../../lib/org/SFPOrg';

const $$ = testSetup();

describe('Retrieve all packages from devhub', () => {
    it('should return all the packages provided a devhub', async () => {
        const testData = new MockTestOrgData();

        testData.makeDevHub();
        $$.setConfigStubContents('AuthInfoConfig', {
            contents: await testData.getConfig(),
        });

        let records: AnyJson = {
            records: [
                {
                    attributes: {
                        type: 'Package2',
                        url: '/services/data/v53.0/tooling/sobjects/Package2/0Ho1P005000k9bNSXQ',
                    },
                    Id: '0Ho1P005000k9bNSXQ',
                    Name: 'async-framework',
                    Description: null,
                    NamespacePrefix: null,
                    ContainerOptions: 'Unlocked',
                    IsOrgDependent: false,
                },
                {
                    attributes: {
                        type: 'Package2',
                        url: '/services/data/v53.0/tooling/sobjects/Package2/0Ho1P005100k9bNSXQ',
                    },
                    Id: '0Ho1P005100k9bNSXQ',
                    Name: 'async-framework2',
                    Description: null,
                    NamespacePrefix: null,
                    ContainerOptions: 'Unlocked',
                    IsOrgDependent: true,
                },
            ],
        };
        $$.fakeConnectionRequest = (request: AnyJson): Promise<AnyJson> => {
            return Promise.resolve(records);
        };
        const org: SFPOrg = await SFPOrg.create({ aliasOrUsername: testData.username });

        let packages = await org.listAllPackages();
        expect(packages).toHaveLength(2);
        expect(packages[0].Name).toMatch('async-framework');
        expect(packages[0].Id).toMatch('0Ho1P005000k9bNSXQ');
        expect(packages[0].IsOrgDependent).toMatch('No');
        expect(packages[1].IsOrgDependent).toMatch('Yes'); //Translate true to Yes
    });
});
