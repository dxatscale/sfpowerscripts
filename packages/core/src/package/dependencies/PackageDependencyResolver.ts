import { Connection } from '@salesforce/core';
import lodash = require('lodash');
import Git from '../../git/Git';
import GitTags from '../../git/GitTags';
import Package2VersionFetcher, { Package2Version } from '../version/Package2VersionFetcher';

/**
 * Resolves package dependency versions to their exact versions
 */
export default class PackageDependencyResolver {
    private package2VersionCache: Package2VersionCache = new Package2VersionCache();

    constructor(
        private conn: Connection,
        private projectConfig,
        private packagesToBeSkipped?: string[],
        private packagesToBeResolved?: string[],
        private resolveExternalDepenciesOnly?: boolean
    ) {
        // prevent mutation of original config
        this.projectConfig = lodash.cloneDeep(this.projectConfig);
    }

    /**
     * Resolves package dependency versions in project config
     * Skips dependencies on packages that are queued for build, as they are resolved dynamically(packagesToBeSkipped)
     * @returns new project config JSON, does not change original JSON
     */
    public async resolvePackageDependencyVersions() {
        for (const packageDirectory of this.projectConfig.packageDirectories) {
            if (this.packagesToBeResolved?.length > 0 && this.packagesToBeSkipped?.length > 0) {
                throw Error(`Unsupported path.. Use only one of the options at any given time`);
            }

            if (this.packagesToBeSkipped && !this.packagesToBeSkipped.includes(packageDirectory.package)) {
                continue;
            }

            if (this.packagesToBeResolved && !this.packagesToBeResolved.includes(packageDirectory.package)) {
                continue;
            }

            if (packageDirectory.dependencies && Array.isArray(packageDirectory.dependencies)) {
                for (let i = 0; i < packageDirectory.dependencies.length; i++) {
                    let dependency = packageDirectory.dependencies[i];
                    if (this.projectConfig.packageAliases[dependency.package] === undefined && !this.isSubscriberPackageVersionId(dependency.package)) {
                        
                        throw new Error(`Can't find package id for dependency: ` + dependency.package);
                    }

                    let packageVersionId = this.isSubscriberPackageVersionId(dependency.package)?dependency.package:this.projectConfig.packageAliases[dependency.package]

                    if (this.isSubscriberPackageVersionId(packageVersionId)) {
                        // Already resolved
                        continue;
                    }

                    if (this.packagesToBeSkipped && this.packagesToBeSkipped.includes(dependency.package)) {
                        // Dependency is part of the same build, will be resolved when new version is created
                        continue;
                    }

                    const package2VersionForDependency = await this.getPackage2VersionForDependency(
                        this.conn,
                        dependency,
                        packageVersionId
                    );

                    if (package2VersionForDependency == null) {
                        packageDirectory.dependencies.splice(i, 1);
                        i--;
                    } else
                        dependency.versionNumber = `${package2VersionForDependency.MajorVersion}.${package2VersionForDependency.MinorVersion}.${package2VersionForDependency.PatchVersion}.${package2VersionForDependency.BuildNumber}`;
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
        dependency: { package: string; versionNumber: string },
        packageVersionId: string
    ): Promise<Package2Version> {

        //Dont hit api's if its only for external dependencies
        if (this.projectConfig.packageDirectories.find((dir) => dir.package === dependency.package)) {
            if (this.resolveExternalDepenciesOnly) return null;
        }

        let package2Version: Package2Version;

        let versionNumber: string = dependency.versionNumber;
        let vers: string[] = versionNumber.split('.');
        if (vers.length === 4 && vers[3] === 'LATEST') {
            versionNumber = `${vers[0]}.${vers[1]}.${vers[2]}`;
        }

        let package2Versions: Package2Version[];
        if (this.package2VersionCache.has(packageVersionId, versionNumber)) {
            package2Versions = this.package2VersionCache.get(
                packageVersionId,
                versionNumber
            );
        } else {
            const package2VersionFetcher = new Package2VersionFetcher(conn);
            const records = await package2VersionFetcher.fetchByPackage2Id(
                packageVersionId,
                versionNumber,
                true
            );
            this.package2VersionCache.set(
                packageVersionId,
                versionNumber,
                records
            );
            package2Versions = this.package2VersionCache.get(
                packageVersionId,
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

        const git = await Git.initiateRepo();
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
     * @param versionNumberstartw
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
