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
    const transitiveDependencyResolver = new TransitiveDependencyResolver(projectConfig);
    let resolvedDependencies = await transitiveDependencyResolver.resolveTransitiveDependencies();

    let dependencies =  resolvedDependencies.get('candidate-management');
    expect(dependencies?.find(dependency => dependency.package === "temp")).toBeTruthy();
    expect(dependencies?.find(dependency => dependency.package === "temp")?.versionNumber).toBe("1.0.0.LATEST");
  });

  it("should resolve package dependencies in the same order as its dependent packages", async () => {
    const transitiveDependencyResolver = new TransitiveDependencyResolver(projectConfig);
    const resolvedDependencies = await transitiveDependencyResolver.resolveTransitiveDependencies();
    
    let baseIndex = resolvedDependencies.get('candidate-management')?.findIndex(dependency => dependency.package === "base");
    expect(baseIndex).toBe(2);
    let tempIndex = resolvedDependencies.get('candidate-management')?.findIndex(dependency => dependency.package === "temp");
    expect(tempIndex).toBe(3);
    let coreIndex = resolvedDependencies.get('candidate-management')?.findIndex(dependency => dependency.package === "core");
    expect(coreIndex).toBe(4);
    
  });


  it("should resolve package dependencies with a higher version of a given package if a higher version is specified", async () => {
    const transitiveDependencyResolver = new TransitiveDependencyResolver(projectConfig);
    const resolvedDependencies = await transitiveDependencyResolver.resolveTransitiveDependencies();
    
    let dependencies =  resolvedDependencies.get('quote-management');
    expect(dependencies?.find(dependency => dependency.package === "core")?.versionNumber).toBe("1.2.0.LATEST");
  
  });

  it("should have only one version of a package", async () => {
    const transitiveDependencyResolver = new TransitiveDependencyResolver(projectConfig);
    const resolvedDependencies = await transitiveDependencyResolver.resolveTransitiveDependencies();
    expect(verifyUniquePkgs(resolvedDependencies.get('quote-management'))).toBeTruthy();
  
  });

  it("should expand the dependencies of external packages", async () => {
    const transitiveDependencyResolver = new TransitiveDependencyResolver(projectConfig);
    const resolvedDependencies = await transitiveDependencyResolver.resolveTransitiveDependencies();
    let externalDependencyIndex = resolvedDependencies.get('contact-management')?.findIndex(dependency => dependency.package === "sfdc-framework");
    expect(externalDependencyIndex).toBe(0);

  });

  function verifyUniquePkgs(arr) {
    let pkgs = {};
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].hasOwnProperty('package')) {
        if (pkgs.hasOwnProperty(arr[i].package)) {
          return false;
        }
        pkgs[arr[i].package] = true;
      }
    }
    return true;
  }
  

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
    "contact-management": '0Ho4a00000000xxxx2',
    "sfdc-framework":"04t1000x00x00x"
  },
  "plugins": {
      "sfpowerscripts": {
          "disableTransitiveDependencyResolver": false,
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

