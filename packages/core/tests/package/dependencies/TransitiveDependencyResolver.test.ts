import { jest, expect } from '@jest/globals';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { Connection, AuthInfo } from '@salesforce/core';
import TransitiveDependencyResolver from '../../../src/package/dependencies/TransitiveDependencyResolver';
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

describe("Given a TransitiveDependencyResolver", () => {

  beforeEach(async () => {
    conn = await setupFakeConnection();

  })

  it("should resolve missing package dependencies with transitive dependency", async () => {
    const transitiveDependencyResolver = new TransitiveDependencyResolver(projectConfig, conn);
    const resolvedProjectConfig: any = await transitiveDependencyResolver.resolveDependencies();

    let packageDescriptor = resolvedProjectConfig.packageDirectories.find((dir) => dir.package === "candidate-management");
    let tempDependency = packageDescriptor.dependencies.find(dependency => dependency.package === "temp");
    expect(tempDependency.versionNumber).toBe("1.0.0.LATEST");
  });

  it("should resolve package dependencies in the same order as its dependent packages", async () => {
    const transitiveDependencyResolver = new TransitiveDependencyResolver(projectConfig, conn);
    const resolvedProjectConfig: any = await transitiveDependencyResolver.resolveDependencies();

    let packageDescriptor = resolvedProjectConfig.packageDirectories.find((dir) => dir.package === "candidate-management");
    let tempIndex = packageDescriptor.dependencies.findIndex(dependency => dependency.package === "temp");
    let baseIndex = packageDescriptor.dependencies.findIndex(dependency => dependency.package === "base");
    expect(tempIndex).toBe(3);
    expect(baseIndex).toBe(2);
  });

  it("should expand the dependencies of external packages", async () => {
    const transitiveDependencyResolver = new TransitiveDependencyResolver(projectConfig, conn);
    const resolvedProjectConfig: any = await transitiveDependencyResolver.resolveDependencies();

    let packageDescriptor = resolvedProjectConfig.packageDirectories.find((dir) => dir.package === "contact-management");
    let externalDependencyIndex = packageDescriptor.dependencies.findIndex(dependency => dependency.package === "sfdc-framework");
    expect(externalDependencyIndex).toBe(0);

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
            package: 'core',
            versionNumber: '1.0.0.LATEST'
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
    "contact-management": '0Ho4a00000000xxxx2'
  },
  "plugins": {
      "sfpowerscripts": {
          "disableTransitiveDependencyResolver": false,
          "transitiveDependencyResolver": {
              "externalDependencyMap": {
                  "tech-framework@2.0.0.38": [
                      {
                          "package": "sfdc-framework"
                      }
                  ]
              }
          }
      }
  }
};

