import { expect } from '@jest/globals';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { Connection, AuthInfo, Logger } from '@salesforce/core';
import {ConsoleLogger, LoggerLevel } from '@dxatscale/sfp-logger';
import ExternalPackage2DependencyResolver from '../../../src/package/dependencies/ExternalPackage2DependencyResolver';
import InstallUnlockedPackageWrapper from '../../../src/sfdxwrappers/InstallUnlockedPackageWrapper';
const $$ = testSetup();

const setupFakeConnection = async () => {
  const testData = new MockTestOrgData();
  testData.makeDevHub();

  $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig(),
  });

  const conn = await Connection.create({
    authInfo: await AuthInfo.create({username: testData.username})
  });

  return conn;
}


let conn: Connection;

describe("Given a InstallUnlockedPackageWrapper", () => {

  beforeEach(async () => {
    conn = await setupFakeConnection();

  })


  it("should generate command with installation key", async () => {
    const externalPackageDependencyResolver = new ExternalPackage2DependencyResolver(conn, falseProjectConfig, {"tech-framework@2.0.0.38":"123123"});
    let externalPackage2s = await externalPackageDependencyResolver.fetchExternalPackage2Dependencies();
    let logger = new ConsoleLogger();
    let installUnlockedPackageWrapper: InstallUnlockedPackageWrapper = new InstallUnlockedPackageWrapper(
      logger,
      LoggerLevel.INFO,
      '.',
      'username',
      externalPackage2s[0].subscriberPackageVersionId,
      '120',
      externalPackage2s[0].key
  );
    expect(installUnlockedPackageWrapper.getGeneratedParams()).toContain('--installationkey=123123')
  });

  // TODO: test cache
});

const falseProjectConfig = {
  packageDirectories: [
      {
          path: 'packages/candidate-management',
          package: 'candidate-management',
          default: false,
          versionName: 'candidate-management-1.0.0',
          versionNumber: '1.0.0.NEXT',
          dependencies: [
            {
              package: 'tech-framework@2.0.0.38'
            }
          ]
      }
  ],
  namespace: '',
  sfdcLoginUrl: 'https://login.salesforce.com',
  sourceApiVersion: '50.0',
  packageAliases: {
    "tech-framework@2.0.0.38": '04t1P00000xxxxxx00',
    "candidate-management": '0Ho4a00000000xxxx1',
    "contact-management": '0Ho4a00000000xxxx2'
  }
};

