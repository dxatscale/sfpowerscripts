import { Logger } from '@flxblio/sfp-logger';
import SfpPackageInquirer from '../../core/package/SfpPackageInquirer';
import ProjectConfig from '../../core/project/ProjectConfig';
import ArtifactFetcher, { Artifact } from '../../core/artifacts/ArtifactFetcher';
import SfpPackage from '../../core/package/SfpPackage';
import SfpPackageBuilder from '../../core/package/SfpPackageBuilder';
import ReleaseDefinition from './ReleaseDefinition';
import _ from 'lodash';

export default class ReleaseDefinitionSorter {

    public sortReleaseDefinitions(
        releaseDefinitions: ReleaseDefinition[],
        leadingSfProjectConfig: any,
        logger: Logger
    ): ReleaseDefinition[] {

        let clonedReleaseDefintions:ReleaseDefinition[] = _.cloneDeep(releaseDefinitions);
        const allPackagesInConfig = ProjectConfig.getAllPackagesFromProjectConfig(leadingSfProjectConfig);
        const packageOccurrenceCount = new Map<string, number>();

        // Count occurrences of each package across all release definitions
        clonedReleaseDefintions.forEach((releaseDefinition) => {
            Object.keys(releaseDefinition.artifacts).forEach((pkg) => {
                if (allPackagesInConfig.includes(pkg)) {
                    // Only consider packages present in the project config
                    packageOccurrenceCount.set(pkg, (packageOccurrenceCount.get(pkg) || 0) + 1);
                }
            });
        });
        // Annotate each release definition with the index of its first unique package
        clonedReleaseDefintions.forEach((releasedefnition) => {
            releasedefnition['firstUniquePackageIndex'] = allPackagesInConfig.length; // Default to length (i.e., end) if no unique package is found
            for (const pkg of allPackagesInConfig) {
                if (releasedefnition.artifacts[pkg] && packageOccurrenceCount.get(pkg) === 1) {
                    // Check if the package is unique
                    releasedefnition['firstUniquePackageIndex'] = allPackagesInConfig.indexOf(pkg);
                    break; // Found the first unique package, no need to continue
                }
            }
        });
        // Sort based on the first unique package's index, placing those without a unique package at the end
        return clonedReleaseDefintions.sort((a, b) => a['firstUniquePackageIndex'] - b['firstUniquePackageIndex']);
    }
}
