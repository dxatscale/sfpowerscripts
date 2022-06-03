import * as fs from 'fs-extra';
import { Connection } from "@salesforce/core";
import Package2VersionFetcher from "../version/Package2VersionFetcher";

const packageIdPrefix = '0Ho';
const packageVersionIdPrefix = '04t';

export default class Fetcher {
    // from projectJson
    // from subscriberPackageVersion which has a Dependencies field

    constructor(private conn: Connection) {}

    async fetchFromProjectConfig(projectConfig: any, packageName?: string): Promise<Package[]> {
        const packages: Package[] = [];

        let packageDirectories = projectConfig.packageDirectories;
        if (packageName) {
            // Filter packageDirectories to package name
            packageDirectories = packageDirectories.filter(dir => dir.package === packageName);
        }

        for (let packageDirectory of packageDirectories) {
            const pkg: Package = {
                name: packageDirectory.package,
                version: packageDirectory.versionNumber,
                dependencies: []
            }
            console.log(`Package dependencies for the given package directory ${packageDirectory.path}`);

            if (packageDirectory.dependencies && packageDirectory.dependencies.length > 0) {
                for (let dependency of packageDirectory.dependencies) {
                    if (projectConfig.packageAliases[dependency.package]) {
                        const pkgDependency = await this.getPackageVersionDetails(dependency, [dependency.package, projectConfig.packageAliases[dependency.package]]);
                        pkg.dependencies.push(pkgDependency);
                    } else {
                        throw new Error(`Alias for package ${dependency.package} cannot be found in packageAliases section of sfdx-project.json`);
                    }
                }
            }
            packages.push(pkg);
        }
        return packages;
    }

    // get the versions for the dependency
    private async getPackageVersionDetails(packageDescriptor, packageAlias: [string, string]): Promise<Package> {
        const pkg : Package = {
            name: packageDescriptor.package,
            version: undefined,
            dependencies: []
        };

        const packageId = packageAlias[1];
        if (packageId.startsWith(packageVersionIdPrefix)) {
            // Package2VersionId is set directly
            pkg.version = {id: packageVersionIdPrefix, number: undefined};
        } else if (packageId.startsWith(packageIdPrefix)) {
            if (!packageDescriptor.versionNumber) {
                throw new Error(`Version number is mandatory for the dependency ${packageDescriptor.package}`);
            }

            this.validateVersionNumber(packageDescriptor.versionNumber);

            let versionNumber: string = packageDescriptor.versionNumber;
            let vers: string[] = versionNumber.split('.');
            if (vers.length === 4 && vers[3] === "LATEST") {
                versionNumber = `${vers[0]}.${vers[1]}.${vers[2]}`;
            }

            const package2VersionFetcher = new Package2VersionFetcher(this.conn);
            const records = await package2VersionFetcher.fetch(packageId, versionNumber, true);

            if (records.length === 0) {
                const errorMessage = `Unable to find package ${packageDescriptor.package} of version ${
                    packageDescriptor.versionNumber
                } in devhub ${this.conn.getUsername()}. Are you sure it has been created?`;
                throw new Error(errorMessage);
            } else {
                pkg.version = records.map(record => ({id: record.SubscriberPackageVersionId, number: `${record.MajorVersion}.${record.MinorVersion}.${record.PatchVersion}.${record.BuildNumber}`}));
            }
        } else {
            throw new Error(`Unknown package alias format ${packageId}`);
        }
        return pkg;
    }

    private validateVersionNumber(versionNumber: string) {
        const validVersionNumberPattern = new RegExp(/^[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+|\.LATEST|\.NEXT)?$/);
        if (!validVersionNumberPattern.test(versionNumber)) {
            throw new Error(`Invalid version number ${versionNumber}. Must be of format 1.0.0.0 or 1.0.0.LATEST or 1.0.0.NEXT`);
        }
    }
}

interface Package {
    name: string;
    version: version | version[];
    dependencies: Package[];
}

interface version {
    id: string;
    number: string;
}