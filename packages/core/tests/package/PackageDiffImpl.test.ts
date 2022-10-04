import { jest, expect } from '@jest/globals';
const fs = require('fs');
import { ConsoleLogger } from '@dxatscale/sfp-logger';
import PackageDiffImpl, { PackageDiffOptions } from '../../src/package/diff/PackageDiffImpl';
import ProjectConfig from '../../src/project/ProjectConfig';

let gitTags: string[] = [];
let gitDiff: string[] = [];
let gitShow: string = '';

jest.mock('../../src/git/Git', () => {
    class Git {
        diff = jest.fn().mockReturnValue(gitDiff);
        show = jest.fn().mockReturnValue(gitShow);
        static async initiateRepo(){
          return new Git();
        }
    }

    return Git;
});

jest.mock('../../src/git/GitTags', () => {
    class GitTags {
        async listTagsOnBranch(): Promise<string[]> {
            return gitTags;
        }
    }

    return GitTags;
});

let ignoreFilterResult: string[] = [];
jest.mock('../../src/ignore/IgnoreFiles', () => {
    class IgnoreFiles {
        filter = jest.fn().mockReturnValue(ignoreFilterResult);
    }

    return IgnoreFiles;
});

describe('Determines whether a given package has changed', () => {
    beforeEach(() => {
        const projectConfigMock = jest.spyOn(ProjectConfig, 'getSFDXProjectConfig');
        projectConfigMock.mockImplementation(() => {
            return JSON.parse(packageConfigJson);
        });

        const fsMock = jest.spyOn(fs, 'readFileSync');
        fsMock.mockImplementation(() => {
            return '**README.md';
        });
    });

    it('should throw error if package does not exist', () => {
        let packageDiffImpl: PackageDiffImpl = new PackageDiffImpl(
            new ConsoleLogger(),
            'UNKNOWN-PACKAGE',
            null,
        );
        expect(() => packageDiffImpl.exec()).rejects.toThrowError();
    });

    it('should return true if package metadata has changed', async () => {
        gitTags = coreTags;
        gitDiff = [`packages/domains/core/X/Y/Z/A-meta.xml`];
        // No change in package config
        gitShow = packageConfigJson;

        // Assume passthrough filter for ignore
        ignoreFilterResult = gitDiff;

        let packageDiffImpl: PackageDiffImpl = new PackageDiffImpl(new ConsoleLogger(), 'core', null);
        let result = await packageDiffImpl.exec();
        expect(result.isToBeBuilt).toEqual(true);
        expect(result.reason).toEqual(`Found change(s) in package`);
    });

    it('should return true if package descriptor has changed', async () => {
        gitTags = coreTags;
        gitDiff = ['sfdx-project.json'];
        gitShow = packageDescriptorChange;

        // Assume passthrough filter for ignore
        ignoreFilterResult = gitDiff;

        let packageDiffImpl: PackageDiffImpl = new PackageDiffImpl(new ConsoleLogger(), 'core', null);
        let result = await packageDiffImpl.exec();
        expect(result.isToBeBuilt).toEqual(true);
        expect(result.reason).toEqual(`Package Descriptor Changed`);
    });

    it('should return false even if package descriptor has changed when asked to ignore ', async () => {
      gitTags = coreTags;
      gitDiff = ['sfdx-project.json'];
      gitShow = packageDescriptorChange;

      // Assume passthrough filter for ignore
      ignoreFilterResult = gitDiff;

      let packageDiffImpl: PackageDiffImpl = new PackageDiffImpl(new ConsoleLogger(), 'core', null,{skipPackageDescriptorChange:true});
      let result = await packageDiffImpl.exec();
      expect(result.isToBeBuilt).toEqual(false);
  });

    it('should return false if only config file has changed', async () => {
        gitDiff = ['config/project-scratch-def.json'];

        // No change in package config
        gitShow = packageConfigJson;

        // Assume passthrough filter for ignore
        ignoreFilterResult = gitDiff;

        gitTags = coreTags;
        let packageDiffImpl: PackageDiffImpl = new PackageDiffImpl(new ConsoleLogger(), 'core', null);
        let result = await packageDiffImpl.exec();
        expect(result.isToBeBuilt).toEqual(false);
        expect(result.reason).toEqual(`No changes found`);
    });

    it('should return true if package does not have any tags', async () => {
        gitTags = [];

        let packageDiffImpl: PackageDiffImpl = new PackageDiffImpl(new ConsoleLogger(), 'core', null);
        let result = await packageDiffImpl.exec();
        expect(result.isToBeBuilt).toEqual(true);
        expect(result.reason).toEqual(`Previous version not found`);
    });

    it('should return true if packageToCommits is an empty object', async () => {
        let packageDiffOptions = new PackageDiffOptions();
        packageDiffOptions.packagesMappedToLastKnownCommitId={};
        let packageDiffImpl: PackageDiffImpl = new PackageDiffImpl(new ConsoleLogger(), 'core', null,packageDiffOptions);
        let result = await packageDiffImpl.exec();
        expect(result.isToBeBuilt).toEqual(true);
        expect(result.reason).toEqual(`Previous version not found`);
    });

    it('should return false if package metadata and package config has not changed', async () => {
        gitTags = coreTags;
        gitDiff = [`packages/access-mgmt/X/Y/Z/A-meta.xml`, `packages/bi/X/Y/Z/B-meta.xml`];
        // No change in package config
        gitShow = packageConfigJson;

        // Assume passthrough filter for ignore
        ignoreFilterResult = gitDiff;

        let packageDiffImpl: PackageDiffImpl = new PackageDiffImpl(new ConsoleLogger(), 'core', null);
        let result = await packageDiffImpl.exec();
        expect(result.isToBeBuilt).toEqual(false);
        expect(result.reason).toEqual(`No changes found`);
    });
});

const coreTags = [
    `core_v1.0.0.2`,
    `core_v1.0.0.3`,
    `core_v1.0.0.5`,
    `core_v1.0.0.6`,
    `core_v1.0.0.7`,
    `core_v1.0.0.8`,
    `core_v1.0.0.9`,
    `core_v1.0.0.10`,
];

const packageConfigJson: string = `
{
  "packageDirectories": [
    {
      "path": "packages/temp",
      "default": true,
      "package": "temp",
      "versionName": "temp",
      "versionNumber": "1.0.0.0",
      "ignoreOnStage": ["prepare","validate","build"]
    },
    {
      "path": "packages/domains/core",
      "package": "core",
      "default": false,
      "versionName": "covax",
      "versionNumber": "1.0.0.0",
      "assignPermSetsPreDeployment": [
        "PermSetA",
        "PermSetB",
        "PermSetC"
      ]
    },
    {
      "path": "packages/frameworks/mass-dataload",
      "package": "mass-dataload",
      "default": false,
      "type":"data",
      "versionName": "mass-dataload",
      "versionNumber": "1.0.0.0"
    },
    {
      "path": "packages/access-mgmt",
      "package": "access-mgmt",
      "default": false,
      "versionName": "access-mgmt",
      "versionNumber": "1.0.0.0",
      "reconcileProfiles": "true"
    },
    {
      "path": "packages/bi",
      "package": "bi",
      "default": false,
      "versionName": "bi",
      "versionNumber": "1.0.0.0",
      "ignoreOnStage":["prepare","validate"]
    }
  ],
  "namespace": "",
  "sfdcLoginUrl": "https://login.salesforce.com",
  "sourceApiVersion": "50.0",
  "packageAliases": {
    "bi":"0x002232323232",
    "core":"0H04X00000000XXXXX"
  }
}`;

const packageDescriptorChange: string = `
{
  "packageDirectories": [
    {
      "path": "packages/temp",
      "default": true,
      "package": "temp",
      "versionName": "temp",
      "versionNumber": "1.0.0.0",
      "ignoreOnStage": ["prepare","validate","build"]
    },
    {
      "path": "packages/domains/core",
      "package": "core",
      "default": false,
      "versionName": "covax",
      "versionNumber": "1.0.0.0",
      "assignPermSetsPreDeployment": [
        "PermSetA"
      ]
    },
    {
      "path": "packages/frameworks/mass-dataload",
      "package": "mass-dataload",
      "default": false,
      "type":"data",
      "versionName": "mass-dataload",
      "versionNumber": "1.0.0.0"
    },
    {
      "path": "packages/access-mgmt",
      "package": "access-mgmt",
      "default": false,
      "versionName": "access-mgmt",
      "versionNumber": "1.0.0.0",
      "reconcileProfiles": "true"
    },
    {
      "path": "packages/bi",
      "package": "bi",
      "default": false,
      "versionName": "bi",
      "versionNumber": "1.0.0.0",
      "ignoreOnStage":["prepare","validate"]
    }
  ],
  "namespace": "",
  "sfdcLoginUrl": "https://login.salesforce.com",
  "sourceApiVersion": "50.0",
  "packageAliases": {
    "bi":"0x002232323232",
    "core":"0H04X00000000XXXXX"
  }
}
`;
