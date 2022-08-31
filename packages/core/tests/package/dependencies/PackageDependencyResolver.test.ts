import { jest, expect } from '@jest/globals';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { Connection, AuthInfo } from '@salesforce/core';
import PackageDependencyResolver from '../../../src/package/dependencies/PackageDependencyResolver';
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

describe("Given a PackageDependencyResolver", () => {

  beforeEach(async () => {
    conn = await setupFakeConnection();
    gitTags = coreGitTags;
    response = coreResponse;
  })

  it("should resolve package dependencies to current branch", async () => {
    const packageDependencyResolver = new PackageDependencyResolver(conn, projectConfig, ["candidate-management", "contact-management"]);
    const resolvedProjectConfig = await packageDependencyResolver.resolvePackageDependencyVersions();

    let packageDescriptor = resolvedProjectConfig.packageDirectories.find((dir) => dir.package === "candidate-management");
    let coreDependency = packageDescriptor.dependencies.find(dependency => dependency.package === "core");
    expect(coreDependency.versionNumber).toBe("1.0.0.2");

    packageDescriptor = resolvedProjectConfig.packageDirectories.find((dir) => dir.package === "contact-management");
    coreDependency = packageDescriptor.dependencies.find(dependency => dependency.package === "core");
    expect(coreDependency.versionNumber).toBe("1.0.0.2");
  });

  it("should skip dependency resolution for packages that are not queued for build", async () => {
    const packageDependencyResolver = new PackageDependencyResolver(conn, projectConfig, ["core"]);
    const resolvedProjectConfig = await packageDependencyResolver.resolvePackageDependencyVersions();

    let packageDescriptor = resolvedProjectConfig.packageDirectories.find((dir) => dir.package === "candidate-management");
    let coreDependency = packageDescriptor.dependencies.find(dependency => dependency.package === "core");
    expect(coreDependency.versionNumber).toBe("1.0.0.LATEST");

    packageDescriptor = resolvedProjectConfig.packageDirectories.find((dir) => dir.package === "contact-management");
    coreDependency = packageDescriptor.dependencies.find(dependency => dependency.package === "core");
    expect(coreDependency.versionNumber).toBe("1.0.0.LATEST");
  });

  it("should skip dependencies on packages from the same build", async () => {
    const packageDependencyResolver = new PackageDependencyResolver(conn, projectConfig, ["core", "candidate-management", "contact-management"]);
    const resolvedProjectConfig = await packageDependencyResolver.resolvePackageDependencyVersions();

    let packageDescriptor = resolvedProjectConfig.packageDirectories.find((dir) => dir.package === "candidate-management");
    let coreDependency = packageDescriptor.dependencies.find(dependency => dependency.package === "core");
    expect(coreDependency.versionNumber).toBe("1.0.0.LATEST");

    packageDescriptor = resolvedProjectConfig.packageDirectories.find((dir) => dir.package === "contact-management");
    coreDependency = packageDescriptor.dependencies.find(dependency => dependency.package === "core");
    expect(coreDependency.versionNumber).toBe("1.0.0.LATEST");
  });

  it("should skip dependencies on a subscriber package version id", async () => {
    const packageDependencyResolver = new PackageDependencyResolver(conn, projectConfig, ["candidate-management"]);
    const resolvedProjectConfig = await packageDependencyResolver.resolvePackageDependencyVersions();

    const packageDescriptor = resolvedProjectConfig.packageDirectories.find((dir) => dir.package === "candidate-management");
    const techFrameworkDependency = packageDescriptor.dependencies.find(dependency => dependency.package.startsWith("tech-framework"));
    expect(techFrameworkDependency.versionNumber).toBeUndefined();
  });

  it("should throw if dependency package version cannot be found for current branch ", async () => {
    gitTags = [];
    const packageDependencyResolver = new PackageDependencyResolver(conn, projectConfig, ["candidate-management"]);
    expect(() => {return packageDependencyResolver.resolvePackageDependencyVersions()}).rejects.toThrow();
  });

  it("should throw if there are no validated dependency package versions", async () => {
    response = {records: []};
    const packageDependencyResolver = new PackageDependencyResolver(conn, projectConfig, ["candidate-management"]);
    expect(() => {return packageDependencyResolver.resolvePackageDependencyVersions()}).rejects.toThrow();
  });

  it("should throw if there are no validated dependency package id", async () => {
    response = {records: []};
    const packageDependencyResolver = new PackageDependencyResolver(conn, falseProjectConfig, ["contact-management"]);
    expect(() => {return packageDependencyResolver.resolvePackageDependencyVersions()}).rejects.toThrow();
  });

  // TODO: test cache
});

let coreGitTags = ['core_v1.0.0.2'];

let coreResponse = {
  records: [
    {
      SubscriberPackageVersionId: '04t1P00000xxxxxxx3',
      Package2Id: '0Ho4a00000000xxxxx',
      Package2: { Name: 'core' },
      IsPasswordProtected: false,
      IsReleased: false,
      MajorVersion: 1,
      MinorVersion: 0,
      PatchVersion: 0,
      BuildNumber: 3,
      CodeCoverage: { apexCodeCoveragePercentage: 80 },
      HasPassedCodeCoverageCheck: true
    },
    {
      SubscriberPackageVersionId: '04t1P00000xxxxxxx2',
      Package2Id: '0Ho4a00000000xxxxx',
      Package2: { Name: 'core' },
      IsPasswordProtected: false,
      IsReleased: false,
      MajorVersion: 1,
      MinorVersion: 0,
      PatchVersion: 0,
      BuildNumber: 2,
      CodeCoverage: { apexCodeCoveragePercentage: 80 },
      HasPassedCodeCoverageCheck: true
    },
    {
      SubscriberPackageVersionId: '04t1P00000xxxxxxx1',
      Package2Id: '0Ho4a00000000xxxxx',
      Package2: { Name: 'core' },
      IsPasswordProtected: false,
      IsReleased: false,
      MajorVersion: 1,
      MinorVersion: 0,
      PatchVersion: 0,
      BuildNumber: 1,
      CodeCoverage: { apexCodeCoveragePercentage: 80 },
      HasPassedCodeCoverageCheck: true
    },
  ]
}

const projectConfig = {
  packageDirectories: [
      {
          path: 'packages/temp',
          default: true,
          package: 'temp',
          versionName: 'temp',
          versionNumber: '1.0.0.0',
      },
      {
          path: 'packages/core',
          package: 'core',
          default: false,
          versionName: 'core-1.0.0',
          versionNumber: '1.0.0.NEXT',
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
            package: 'core',
            versionNumber: '1.0.0.LATEST'
          }
        ]
    }
  ],
  namespace: '',
  sfdcLoginUrl: 'https://login.salesforce.com',
  sourceApiVersion: '50.0',
  packageAliases: {
    "tech-framework@2.0.0.38": '04t1P00000xxxxxx00',
    "core": '0Ho4a00000000xxxxx',
    "candidate-management": '0Ho4a00000000xxxx1',
    "contact-management": '0Ho4a00000000xxxx2'
  }
};

const falseProjectConfig = {
  packageDirectories: [
      {
          path: 'packages/temp',
          default: true,
          package: 'temp',
          versionName: 'temp',
          versionNumber: '1.0.0.0',
      },
      {
          path: 'packages/core',
          package: 'core',
          default: false,
          versionName: 'core-1.0.0',
          versionNumber: '1.0.0.NEXT',
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
            package: 'core',
            versionNumber: '1.0.0.LATEST'
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

