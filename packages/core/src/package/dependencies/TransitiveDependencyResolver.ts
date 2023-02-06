import ProjectConfig from '../../project/ProjectConfig';
import { COLOR_HEADER, COLOR_KEY_MESSAGE, COLOR_SUCCESS, COLOR_ERROR } from '@dxatscale/sfp-logger';
import SFPLogger, { LoggerLevel, Logger } from '@dxatscale/sfp-logger';
import _ from 'lodash';
import semver = require('semver');
import convertBuildNumDotDelimToHyphen from '../../utils/VersionNumberConverter';
import { Connection } from '@salesforce/core';
import UserDefinedExternalDependencyMap from '../../project/UserDefinedExternalDependency';

export default class TransitiveDependencyResolver {
    constructor(private sfdxProjectConfig: any, private connToDevHub: Connection, private logger?: Logger) {}

    public async resolveTransitiveDependencies(): Promise<Map<string, { package: string; versionNumber?: string }[]>> {
        SFPLogger.log('Validating Project Dependencies...', LoggerLevel.INFO, this.logger);

        let updateProjectConfig = await _.cloneDeep(this.sfdxProjectConfig);

        let pkgWithDependencies = ProjectConfig.getAllPackagesAndItsDependencies(updateProjectConfig);
        pkgWithDependencies = this.fillDepsWithUserDefinedExternalDependencyMap(
            pkgWithDependencies,
            new UserDefinedExternalDependencyMap().fetchDependencyEntries(updateProjectConfig)
        );
        pkgWithDependencies = this.fillDepsTransitively(pkgWithDependencies);

        return pkgWithDependencies;
    }

    private fillDepsWithUserDefinedExternalDependencyMap(
        pkgWithDependencies: Map<string, { package: string; versionNumber?: string }[]>,
        externalDependencyMap: any
    ): Map<string, { package: string; versionNumber?: string }[]> {
        if (externalDependencyMap) {
            for (let pkg of Object.keys(externalDependencyMap)) {
                pkgWithDependencies.set(pkg , externalDependencyMap[pkg]);
            }
        }
        return pkgWithDependencies;
    }

    private fillDepsTransitively(
        dependencyMap: Map<string, { package: string; versionNumber?: string }[]>
    ): Map<string, { package: string; versionNumber?: string }[]> {
        let pkgs = Array.from(dependencyMap.keys());
        for (let pkg of pkgs) {
            SFPLogger.log(
                COLOR_HEADER(`fetching dependencies for package:`) + COLOR_KEY_MESSAGE(pkg),
                LoggerLevel.TRACE,
                this.logger
            );
            let dependenencies: { package: string; versionNumber?: string }[] = [];
            for (let dependency of dependencyMap.get(pkg)) {
                if (dependencyMap.get(dependency.package)) {
                    //push parents first
                    dependenencies=dependenencies.concat(dependencyMap.get(dependency.package));
                    SFPLogger.log(
                        `pushing ${dependencyMap.get(dependency.package).length} dependencies from package ${
                            dependency.package
                        }`,
                        LoggerLevel.TRACE,
                        this.logger
                    );
                }
                //push itself
                dependenencies.push(dependency);
            }
            //deduplicate dependency list
            let uniqueDependencies = [
                ...new Set(dependenencies.map((objects) => JSON.stringify(objects))),
            ].map((tmpString) => JSON.parse(tmpString));
            for (var j = 0; j < uniqueDependencies.length; j++) {
                if (uniqueDependencies[j].versionNumber) {
                    let version = convertBuildNumDotDelimToHyphen(uniqueDependencies[j].versionNumber);

                    for (var i = j + 1; i < uniqueDependencies.length; i++) {
                        if (uniqueDependencies[j].package == uniqueDependencies[i].package) {
                            let versionToCompare = convertBuildNumDotDelimToHyphen(uniqueDependencies[i].versionNumber);
                            // replace existing packageInfo if package version number is newer
                            if (semver.lt(version, versionToCompare)) {
                                uniqueDependencies.splice(j, 1);
                            } else {
                                uniqueDependencies.splice(i, 1);
                            }
                        }
                    }
                }
            }
            dependencyMap.set(pkg,uniqueDependencies)
        }
        return dependencyMap;
    }
}