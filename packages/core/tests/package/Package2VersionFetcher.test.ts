import { expect } from '@jest/globals';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { Connection, AuthInfo } from '@salesforce/core';
import Package2VersionFetcher from '../../src/package/version/Package2VersionFetcher';
import { AnyJson } from '@salesforce/ts-types';

const $$ = testSetup();

let conn: Connection;

describe("Given a PackageDependencyResolver", () => {

  beforeEach(async () => {
    const testData = new MockTestOrgData();

        testData.makeDevHub();
        $$.setConfigStubContents('AuthInfoConfig', {
            contents: await testData.getConfig(),
        });

        let records: any = {
            records: [
              {
                attributes: {
                  type: 'Package2Version',
                  url: '/services/data/v57.0/tooling/sobjects/Package2Version/05i5i000000TNPWAA4'
                },
                SubscriberPackageVersionId: '04t5i000000V2DiAAK',
                Package2Id: '0Ho5i000000sYaWCAU',
                Package2: { attributes: [Object], Name: 'core' },
                IsPasswordProtected: false,
                IsReleased: false,
                MajorVersion: 0,
                MinorVersion: 1,
                PatchVersion: 0,
                BuildNumber: 17,
                CodeCoverage: { apexCodeCoveragePercentage: 100 },
                HasPassedCodeCoverageCheck: true,
                Branch: 'king'
              },
              {
                attributes: {
                  type: 'Package2Version',
                  url: '/services/data/v57.0/tooling/sobjects/Package2Version/05i5i000000TNOiAAO'
                },
                SubscriberPackageVersionId: '04t5i000000UyCJAA0',
                Package2Id: '0Ho5i000000sYaWCAU',
                Package2: { attributes: [Object], Name: 'core' },
                IsPasswordProtected: false,
                IsReleased: false,
                MajorVersion: 0,
                MinorVersion: 1,
                PatchVersion: 0,
                BuildNumber: 16,
                CodeCoverage: { apexCodeCoveragePercentage: 100 },
                HasPassedCodeCoverageCheck: true,
                Branch: 'king'
              }
            ],
        };
        $$.fakeConnectionRequest = (request: any): Promise<any> => {
            return Promise.resolve(records);
        };
        conn = await Connection.create({
          authInfo: await AuthInfo.create({username: testData.username})
        });
  })
  it('should return an array of Package2Version records if matching records found', async () => {
    // Mock the query method in QueryHelper to return some dummy data
    const package2VersionFetcher = new Package2VersionFetcher(conn);

    const result = await package2VersionFetcher.fetchByPackageBranchAndName('king', 'core');

    expect(result[0].Package2.Name).toEqual('core');
    expect(result[0].Branch).toEqual('king');
  });

});

