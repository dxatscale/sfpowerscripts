import { jest, expect } from '@jest/globals';
const fs = require('fs-extra');
import ReleaseDefinition from '../../../src/impl/release/ReleaseDefinition';

describe('Given a release definition, validateReleaseDefinition', () => {
    let releaseDefinitionYaml: string;

    beforeEach(() => {
        const fsMock = jest.spyOn(fs, 'readFileSync');
        fsMock.mockImplementation(() => {
            return releaseDefinitionYaml;
        });
    });

    it('should throw if artifacts field is missing', async () => {
        releaseDefinitionYaml = `
      release: "test-release"
    `;

        expect(async () => {
            await ReleaseDefinition.loadReleaseDefinition('path');
        }).rejects.toThrowError();
    });

    it('should throw if release field is missing', async () => {
        releaseDefinitionYaml = `
      artifacts:
        packageA: "1.0.0-0"
    `;

        expect(async () => {
            await ReleaseDefinition.loadReleaseDefinition('path');
        }).rejects.toThrowError();
    });

    it('should not throw an error for valid package dependency', async () => {
        releaseDefinitionYaml = `
      release: "test-release"
      artifacts:
        packageA: "3.0.5-13"
      packageDependencies:
        packageX: 04t0H000000xVrwQAE
    `;

        expect(async () => {
            await ReleaseDefinition.loadReleaseDefinition('path');
        }).toBeDefined();
    });

    it('should throw an error for an invalid package dependency', async () => {
        releaseDefinitionYaml = `
      release: "test-release"
      artifacts:
        packageA: "3.0.5-13"
      packageDependencies:
        packageX: 04t0H000000xVrwQAE123
    `;

        expect(async () => {
            await ReleaseDefinition.loadReleaseDefinition('path');
        }).rejects.toThrowError();
    });

    it('should not throw an error for valid release parameters', async () => {
        releaseDefinitionYaml = `
      release: "test-release"
      skipIfAlreadyInstalled: true
      baselineOrg: "prod"
      artifacts:
        packageA: "3.0.5-13"
    `;

        expect(async () => {
            await ReleaseDefinition.loadReleaseDefinition('path');
        }).toBeDefined();
    });

    it('should throw an error if baselineOrg specified but skipIfAlreadyInstalled is false', async () => {
        releaseDefinitionYaml = `
      release: "test-release"
      skipIfAlreadyInstalled: false
      baselineOrg: "prod"
      artifacts:
        packageA: "3.0.5-13"
    `;

        expect(async () => {
            await ReleaseDefinition.loadReleaseDefinition('path');
        }).rejects.toThrowError();
    });

    it('should not throw an error for valid changelog parameters', async () => {
        releaseDefinitionYaml = `
      release: "test-release"
      artifacts:
        packageA: "3.0.5-13"
      changelog:
        workItemFilters:
         - "GOR-[0-9]{4}"
        workItemUrl: "https://www.atlassian.com/software/jira"
        limit: 10
        showAllArtifacts: false
    `;

        expect(async () => {
            await ReleaseDefinition.loadReleaseDefinition('path');
        }).toBeDefined();
    });

    it('should throw an error if required changelog parameters are missing', async () => {
        releaseDefinitionYaml = `
      release: "test-release"
      artifacts:
        packageA: "3.0.5-13"
      changelog:
        workItemUrl: "https://www.atlassian.com/software/jira"
        limit: 10
        showAllArtifacts: false
    `;

        expect(async () => {
            await ReleaseDefinition.loadReleaseDefinition('path');
        }).rejects.toThrow();
    });
});
