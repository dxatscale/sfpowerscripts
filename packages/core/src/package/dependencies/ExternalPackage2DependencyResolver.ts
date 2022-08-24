import { Connection } from '@salesforce/core';
import PackageDependencyResolver from './PackageDependencyResolver';
import _ from 'lodash';
import Package2VersionFetcher from '../version/Package2VersionFetcher';
import Package2Detail from '../Package2Detail';


/**
 * Resolves external package dependency versions to their subscriber version
 */
export default class ExternalPackage2DependencyResolver {
    //TOOD: Finalize Keys
    constructor(private conn: Connection, private projectConfig, private keys) {}

    public async fetchExternalPackage2Dependencies(pkg?:string): Promise<Package2Detail[]> {

        //Do a dependency resolution first only for external dependencies
        //Resolve .LATEST to exact version numbers
        let revisedProjectConfig = await new PackageDependencyResolver(
            this.conn,
            this.projectConfig,
            null,
            pkg?[pkg]:null,
            true
        ).resolvePackageDependencyVersions();

        let packageVersions: Package2Detail[] = [];
        let packageVersionFetcher = new Package2VersionFetcher(this.conn);

        let packagesToKeys: { [p: string]: string };
        if (this.keys) {
            packagesToKeys = this.parseKeys(this.keys);
        }

        //Resolve provided version Number to SubscriberVersionId
        for (const packageDirectory of revisedProjectConfig.packageDirectories) {

            if(pkg && packageDirectory.package!=pkg)
              continue;

            if (packageDirectory.dependencies && Array.isArray(packageDirectory.dependencies)) {
                for (let i = 0; i < packageDirectory.dependencies.length; i++) {
                    let dependency = packageDirectory.dependencies[i];
                    if (!packageVersions.find((elem) => elem.name == dependency.package)) {
                        let dependendentPackage: Package2Detail = { name: dependency.package };
                        if (dependency.versionNumber) {
                            dependendentPackage.versionNumber=dependency.versionNumber;
                            let packageVersion = await packageVersionFetcher.fetchByPackage2Id(
                                revisedProjectConfig.packageAliases[dependendentPackage.name],
                                dependendentPackage.versionNumber,
                                true
                            );
                            dependendentPackage.subscriberPackageVersionId=
                                packageVersion[0].SubscriberPackageVersionId;
                        } else {
                            dependendentPackage.subscriberPackageVersionId = revisedProjectConfig.packageAliases[dependendentPackage.name];
                        }
                        if(packagesToKeys?.[dependendentPackage.name]){
                            dependendentPackage.key = packagesToKeys[dependency.package];
                        }
                        packageVersions.push(dependendentPackage);
                    }
                }
            }
        }
        return packageVersions;
    }

    /**
     * Parse keys in string format "packageA:key packageB:key packageC:key"
     * Returns map of packages to keys
     * @param keys
     */
     private parseKeys(keys: string) {
        let output: { [p: string]: string } = {};

        keys = keys.trim();
        let listOfKeys = keys.split(' ');

        for (let key of listOfKeys) {
            let packageKeyPair = key.split(':');
            if (packageKeyPair.length === 2) {
                output[packageKeyPair[0]] = packageKeyPair[1];
            } else {
                // Format is incorrect, throw an error
                throw new Error(`Error parsing keys, format should be: "packageA:key packageB:key packageC:key"`);
            }
        }
        return output;
    }
}

