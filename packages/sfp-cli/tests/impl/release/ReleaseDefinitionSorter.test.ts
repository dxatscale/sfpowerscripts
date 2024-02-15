import { ConsoleLogger } from '@flxblio/sfp-logger';
import ReleaseDefinitionSorter from '../../../src/impl/release/ReleaseDefinitionSorter'; // Adjust the import path to where your function is defined
import { expect } from '@jest/globals';

describe('Sort Release Definitions by leading project config', () => {
    it('should sort release definitions when packages are shared', async () => {
        // Mock input data
        const releaseDefinitions = [
            {
                release: 'Release1',
                artifacts: { PackageB: '1.0.0', PackageC: '1.0.0' },
                skipIfAlreadyInstalled: false,
                skipArtifactUpdate: false,
            },
            {
                release: 'Release2',
                artifacts: { PackageA: '1.0.0', PackageB: '1.0.0', PackageD: '1.0.0' },
                skipIfAlreadyInstalled: false,
                skipArtifactUpdate: false,
            },
            {
                release: 'Release3',
                artifacts: { PackageE: '1.0.0' },
                skipIfAlreadyInstalled: false,
                skipArtifactUpdate: false,
            },
        ];
        const leadingSfProjectConfig = {
            packageDirectories: [
                { package: 'PackageA', versionNumber: '1.0.0' },
                { package: 'PackageB', versionNumber: '1.0.0' },
                { package: 'PackageC', versionNumber: '1.0.0' },
                { package: 'PackageD', versionNumber: '1.0.0' },
                { package: 'PackageE', versionNumber: '1.0.0' },
            ],
        };

        // Call the function to test
        const sortedReleaseDefinitions = await new ReleaseDefinitionSorter().sortReleaseDefinitions(
            releaseDefinitions,
            leadingSfProjectConfig,
            new ConsoleLogger()
        );

        const sortedReleaseOrder = sortedReleaseDefinitions.map((def) => def.release);
        const expectedReleaseOrder = ['Release2', 'Release1', 'Release3'];
        expect(sortedReleaseOrder).toEqual(expectedReleaseOrder);
    });

    it('should sort release definitions when the first release definition has the last package and packages are shared', async () => {
        // Mock input data
        const releaseDefinitions = [
            {
                release: 'Release3',
                artifacts: { PackageE: '1.0.0' },
                skipIfAlreadyInstalled: false,
                skipArtifactUpdate: false,
            },
            {
                release: 'Release2',
                artifacts: { PackageA: '1.0.0', PackageB: '1.0.0', PackageC: '1.0.0' },
                skipIfAlreadyInstalled: false,
                skipArtifactUpdate: false,
            },
            {
              release: 'Release1',
              artifacts: { PackageB: '1.0.0' },
              skipIfAlreadyInstalled: false,
              skipArtifactUpdate: false,
          },
        ];
        const leadingSfProjectConfig = {
            packageDirectories: [
                { package: 'PackageA', versionNumber: '1.0.0' },
                { package: 'PackageB', versionNumber: '1.0.0' },
                { package: 'PackageC', versionNumber: '1.0.0' },
                { package: 'PackageD', versionNumber: '1.0.0' },
                { package: 'PackageE', versionNumber: '1.0.0' },
            ],
        };

        // Call the function to test
        const sortedReleaseDefinitions = await new ReleaseDefinitionSorter().sortReleaseDefinitions(
            releaseDefinitions,
            leadingSfProjectConfig,
            new ConsoleLogger()
        );

        const sortedReleaseOrder = sortedReleaseDefinitions.map((def) => def.release);
        const expectedReleaseOrder = ['Release2', 'Release3', 'Release1'];
        expect(sortedReleaseOrder).toEqual(expectedReleaseOrder);
    });

    it('should return the same definition when only one is provided', async () => {
      // Mock input data
      const releaseDefinitions = [
          {
              release: 'Release3',
              artifacts: { PackageE: '1.0.0' },
              skipIfAlreadyInstalled: false,
              skipArtifactUpdate: false,
          }
      ];
      const leadingSfProjectConfig = {
          packageDirectories: [
              { package: 'PackageA', versionNumber: '1.0.0' },
              { package: 'PackageB', versionNumber: '1.0.0' },
              { package: 'PackageC', versionNumber: '1.0.0' },
              { package: 'PackageD', versionNumber: '1.0.0' },
              { package: 'PackageE', versionNumber: '1.0.0' },
          ],
      };

      // Call the function to test
      const sortedReleaseDefinitions = await new ReleaseDefinitionSorter().sortReleaseDefinitions(
          releaseDefinitions,
          leadingSfProjectConfig,
          new ConsoleLogger()
      );

      const sortedReleaseOrder = sortedReleaseDefinitions.map((def) => def.release);
      const expectedReleaseOrder = ['Release3'];
      expect(sortedReleaseOrder).toEqual(expectedReleaseOrder);
    });

    it('should sort release definitions when no packages are shared', async () => {
      // Mock input data
      const releaseDefinitions = [
          {
              release: 'Release3',
              artifacts: { PackageE: '1.0.0' },
              skipIfAlreadyInstalled: false,
              skipArtifactUpdate: false,
          },
          {
              release: 'Release2',
              artifacts: { PackageA: '1.0.0', PackageB: '1.0.0' },
              skipIfAlreadyInstalled: false,
              skipArtifactUpdate: false,
          },
          {
            release: 'Release1',
            artifacts: { PackageC: '1.0.0' },
            skipIfAlreadyInstalled: false,
            skipArtifactUpdate: false,
        },
      ];
      const leadingSfProjectConfig = {
          packageDirectories: [
              { package: 'PackageA', versionNumber: '1.0.0' },
              { package: 'PackageB', versionNumber: '1.0.0' },
              { package: 'PackageC', versionNumber: '1.0.0' },
              { package: 'PackageD', versionNumber: '1.0.0' },
              { package: 'PackageE', versionNumber: '1.0.0' },
          ],
      };

      // Call the function to test
      const sortedReleaseDefinitions = await new ReleaseDefinitionSorter().sortReleaseDefinitions(
          releaseDefinitions,
          leadingSfProjectConfig,
          new ConsoleLogger()
      );

      const sortedReleaseOrder = sortedReleaseDefinitions.map((def) => def.release);
      const expectedReleaseOrder = ['Release2', 'Release1', 'Release3'];
      expect(sortedReleaseOrder).toEqual(expectedReleaseOrder);
  });
});
