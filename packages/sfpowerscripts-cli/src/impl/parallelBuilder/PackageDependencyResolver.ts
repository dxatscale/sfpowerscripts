import Package2VersionFetcher, {
    Package2Version,
} from '@dxatscale/sfpowerscripts.core/lib/package/version/Package2VersionFetcher';
import { Connection } from '@salesforce/core';
import Git from '@dxatscale/sfpowerscripts.core/lib/git/Git';
import GitTags from '@dxatscale/sfpowerscripts.core/lib/git/GitTags';
import lodash = require('lodash');

/**
 * Resolves package dependency versions in project config, for Build orchestrator command
 */
export default class PackageDependencyResolver {
    private package2VersionCache: Package2VersionCache = new Package2VersionCache();

    constructor(private conn: Connection, private projectConfig, private packagesToBeBuilt: string[]) {
      // prevent mutation of original config
      this.projectConfig = lodash.cloneDeep(this.projectConfig);
    }

    /**
     * Resolves package dependency versions in project config
     * Skips dependencies on packages that are queued for build, as they are resolved dynamically
     * @returns new project config JSON, does not change original JSON
     */
    public async resolvePackageDependencyVersions() {
        for (const packageDirectory of this.projectConfig.packageDirectories) {
            if (this.packagesToBeBuilt.includes(packageDirectory.package)) {
                if (packageDirectory.dependencies && Array.isArray(packageDirectory.dependencies)) {
                    for (const dependency of packageDirectory.dependencies) {
                        if (this.isSubscriberPackageVersionId(this.projectConfig.packageAliases[dependency.package])) {
                            // Already resolved
                            continue;
                        }

                        if (this.packagesToBeBuilt.includes(dependency.package)) {
                            // Dependency is part of the same build, will be resolved when new version is created
                            continue;
                        }

                        const package2VersionForDependency = await this.getPackage2VersionForDependency(
                            this.conn,
                            dependency
                        );

                        dependency.versionNumber = `${package2VersionForDependency.MajorVersion}.${package2VersionForDependency.MinorVersion}.${package2VersionForDependency.PatchVersion}.${package2VersionForDependency.BuildNumber}`;
                    }
                }
            }
        }

        return this.projectConfig;
    }

    /**
     * Get last validated Package2 version for package dependency
     * @param conn
     * @param dependency
     * @returns Package2Version
     */
    private async getPackage2VersionForDependency(
        conn: Connection,
        dependency: { package: string; versionNumber: string }
    ): Promise<Package2Version> {
        let package2Version: Package2Version;

        let versionNumber: string = dependency.versionNumber;
        let vers: string[] = versionNumber.split('.');
        if (vers.length === 4 && vers[3] === 'LATEST') {
            versionNumber = `${vers[0]}.${vers[1]}.${vers[2]}`;
        }

        let package2Versions: Package2Version[];
        if (this.package2VersionCache.has(this.projectConfig.packageAliases[dependency.package], versionNumber)) {
            package2Versions = this.package2VersionCache.get(
                this.projectConfig.packageAliases[dependency.package],
                versionNumber
            );
        } else {
            const package2VersionFetcher = new Package2VersionFetcher(conn);
            const records = await package2VersionFetcher.fetchByPackage2Id(
                this.projectConfig.packageAliases[dependency.package],
                versionNumber,
                true
            );
            this.package2VersionCache.set(
                this.projectConfig.packageAliases[dependency.package],
                versionNumber,
                records
            );
            package2Versions = this.package2VersionCache.get(
                this.projectConfig.packageAliases[dependency.package],
                versionNumber
            );
        }

        if (package2Versions.length === 0) {
            throw new Error(
                `Failed to find any validated Package2 versions for the dependency ${dependency.package} with version ${dependency.versionNumber}`
            );
        }

        if (this.projectConfig.packageDirectories.find((dir) => dir.package === dependency.package)) {
            package2Version = await this.getPackage2VersionFromCurrentBranch(package2Versions, dependency);
        } else {
            // Take last validated package for external packages
            package2Version = package2Versions[0];
        }

        return package2Version;
    }

    /**
     * Get Package2 version created from the current branch
     * @param package2Versions
     * @param dependency
     * @returns Package2Version
     */
    private async getPackage2VersionFromCurrentBranch(
        package2Versions: Package2Version[],
        dependency: { package: string; versionNumber: string }
    ) {
        let package2VersionOnCurrentBranch: Package2Version;

        const git = new Git();
        const gitTags = new GitTags(git, dependency.package);
        const tags = await gitTags.listTagsOnBranch();

        for (const package2Version of package2Versions) {
            const version = `${package2Version.MajorVersion}.${package2Version.MinorVersion}.${package2Version.PatchVersion}.${package2Version.BuildNumber}`;
            for (const tag of tags) {
                if (tag.endsWith(version)) {
                    package2VersionOnCurrentBranch = package2Version;
                    break;
                }
            }
            if (package2VersionOnCurrentBranch) break;
        }

        if (!package2VersionOnCurrentBranch) {
            throw new Error(
                `Failed to find validated Package2 version for dependency ${dependency.package} with version ${dependency.versionNumber} created from the current branch`
            );
        }

        return package2VersionOnCurrentBranch;
    }

    private isSubscriberPackageVersionId(packageAlias: string): boolean {
        const subscriberPackageVersionIdPrefix = '04t';
        return packageAlias.startsWith(subscriberPackageVersionIdPrefix);
    }
}

class Package2VersionCache {
    private cache: { [p: string]: Package2Version[] } = {};

    /**
     * Checks whether cache contains key for package ID and version number
     * @param packageId
     * @param versionNumber
     * @returns true or false
     */
    has(packageId: string, versionNumber: string): boolean {
        const key = `${packageId}-${versionNumber}`;
        if (this.cache[key]) return true;
        else return false;
    }

    /**
     * Set the cache value, Package2 versions, for package ID and version number
     * @param packageId
     * @param versionNumber
     * @param package2Versions
     * @returns cache
     */
    set(
        packageId: string,
        versionNumber: string,
        package2Versions: Package2Version[]
    ): { [p: string]: Package2Version[] } {
        const key = `${packageId}-${versionNumber}`;
        this.cache[key] = package2Versions;
        return this.cache;
    }

    /**
     *
     * @param packageId
     * @param versionNumber
     * @returns Package2 versions for package ID and version number
     */
    get(packageId: string, versionNumber: string): Package2Version[] {
        const key = `${packageId}-${versionNumber}`;
        return this.cache[key];
    }
}
