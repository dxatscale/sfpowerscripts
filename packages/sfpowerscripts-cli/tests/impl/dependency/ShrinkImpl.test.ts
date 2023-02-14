import { jest, expect } from '@jest/globals';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { Connection, AuthInfo } from '@salesforce/core';
import ShrinkImpl from '../../../src/impl/dependency/ShrinkImpl';
const $$ = testSetup();

const setupFakeConnection = async () => {
  const testData = new MockTestOrgData();
  testData.makeDevHub();

  $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig(),
  });
  $$.fakeConnectionRequest = (request) => {
    return Promise.resolve(response);
  };

  const conn = await Connection.create({
    authInfo: await AuthInfo.create({username: testData.username})
  });

  return conn;
}

jest.mock('../../../../core/src/git/Git', () => {
  class Git {
    static async initiateRepo()
     {
      return new Git();
     }
  }

  return Git;
});

jest.mock('../../../../core/src/git/GitTags', () => {
  class GitTags {
      async listTagsOnBranch(): Promise<string[]> {
          return gitTags;
      }
  }

  return GitTags;
});

let conn: Connection;
let gitTags;
let response;

describe("Given a ShrinkImpl", () => {

  beforeEach(async () => {
    conn = await setupFakeConnection();

  })

  it("should remove duplicate package dependencies from its dependent package", async () => {
    const shrinkImpl = new ShrinkImpl(conn);
    let resolvedDependencies = await shrinkImpl.shrinkDependencies(projectConfig);

    let dependencies =  resolvedDependencies.packageDirectories?.find(pkg => pkg.package === "candidate-management")?.dependencies;
    let coreIndex = dependencies.findIndex(dependency => dependency.package === "core");
    expect(dependencies).toBeTruthy();
    expect(dependencies?.length)?.toBe(2);
    expect(coreIndex).toBe(1);
  });

  it("should remove duplicate package dependencies from external dependency map", async () => {
    const shrinkImpl = new ShrinkImpl(conn);
    let resolvedDependencies = await shrinkImpl.shrinkDependencies(projectConfig);

    let dependencies =  resolvedDependencies.packageDirectories?.find(pkg => pkg.package === "contact-management")?.dependencies;
    let coreIndex = dependencies.findIndex(dependency => dependency.package === "core");
    expect(dependencies).toBeTruthy();
    expect(dependencies?.length)?.toBe(2);
    expect(coreIndex).toBe(1);
  });


  // TODO: test cache
});

const projectConfig = {
  packageDirectories: [
      {
      path: 'packages/base',
      default: true,
      package: 'base',
      versionName: 'temp',
      versionNumber: '1.0.2.NEXT',
      },
      {
          path: 'packages/temp',
          default: true,
          package: 'temp',
          versionName: 'temp',
          versionNumber: '1.0.0.NEXT',
          dependencies: [
            {
              package: 'base',
              versionNumber: '1.0.2.LATEST'
            }
          ] 
      },
      {
          path: 'packages/core',
          package: 'core',
          default: false,
          versionName: 'core-1.0.0',
          versionNumber: '1.0.0.NEXT',
          dependencies: [
            {
              package: 'base',
              versionNumber: '1.0.2.LATEST'
            },
            {
              package: 'temp',
              versionNumber: '1.0.0.LATEST'
            }
          ] 
      },
      {
          path: 'packages/candidate-management',
          package: 'candidate-management',
          default: false,
          versionName: 'candidate-management-1.0.0',
          versionNumber: '1.0.0.NEXT',
          dependencies: [
            {
              package: 'tech-framework@2.0.0.38'
            },
            {
              package: 'base',
              versionNumber: '1.0.2.LATEST'
            },
            {
              package: 'temp',
              versionNumber: '1.0.0.LATEST'
            },
            {
              package: 'core',
              versionNumber: '1.0.0.LATEST'
            }
          ]
      },
      {
        path: 'packages/contact-management',
        package: 'contact-management',
        default: false,
        versionName: 'contact-management-1.0.0',
        versionNumber: '1.0.0.NEXT',
        dependencies: [
          {
            package: 'tech-framework@2.0.0.38'
          },
          {
            package: "sfdc-framework"
          },
          {
            package: 'base',
            versionNumber: '1.0.2.LATEST'
          },
          {
            package: 'temp',
            versionNumber: '1.0.0.LATEST'
          },
          {
            package: 'core',
            versionNumber: '1.0.0.LATEST'
          }
        ]
    },
    {
      path: 'packages/quote-management',
      package: 'quote-management',
      default: false,
      versionName: 'quote-management-1.0.0',
      versionNumber: '1.0.0.NEXT',
      dependencies: [
        {
          package: 'tech-framework@2.0.0.38'
        },
        {
          package: 'core',
          versionNumber: '1.2.0.LATEST'
        },
        {
          package: 'candidate-management',
          versionNumber: '1.0.0.LATEST'
        },
      ]
  }
  ],
  namespace: '',
  sfdcLoginUrl: 'https://login.salesforce.com',
  sourceApiVersion: '50.0',
  packageAliases: {
    "tech-framework@2.0.0.38": '04t1P00000xxxxxx00',
    "candidate-management": '0Ho4a00000000xxxx1',
    "base": '0Ho4a00000000xxxx1',
    "temp": '0Ho4a00000000xxxx1',
    "core": '0Ho4a00000000xxxx1',
    "contact-management": '0Ho4a00000000xxxx2',
    "sfdc-framework":"04t1000x00x00x"
  },
  "plugins": {
      "sfpowerscripts": {
          "disableShrinkImpl": false,
              "externalDependencyMap": {
                  "tech-framework@2.0.0.38": [
                      {
                          "package": "sfdc-framework"
                      }
                  ]
              }
      }
  }
};

