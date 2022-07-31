import { Connection } from '@salesforce/core';
import PackageDependencyResolver from './PackageDependencyResolver';
import Package2VersionFetcher from '@dxatscale/sfpowerscripts.core/lib/package/version/Package2VersionFetcher';
import _ from 'lodash';
import Package2Detail from '@dxatscale/sfpowerscripts.core/lib/package/Package2Detail';

export default class ExternalPackage2DependencyResolver {
    //TOOD: Finalize Keys
    constructor(private conn: Connection, private projectConfig, private keys) {}

    public async fetchExternalPackage2Dependencies(): Promise<Package2Detail[]> {

        //Do a dependency resolution first only for external dependencies
        //Resolve .LATEST to exact version numbers
        let revisedProjectConfig = await new PackageDependencyResolver(
            this.conn,
            this.projectConfig,
            null,
            true
        ).resolvePackageDependencyVersions();

        let packageVersions: Package2Detail[] = [];
        let packageVersionFetcher = new Package2VersionFetcher(this.conn);

        //Resolve provided version Number to SubscriberVersionId
        for (const packageDirectory of revisedProjectConfig.packageDirectories) {
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

                        packageVersions.push(dependendentPackage);
                    }
                }
            }
        }
        return packageVersions;
    }
}

