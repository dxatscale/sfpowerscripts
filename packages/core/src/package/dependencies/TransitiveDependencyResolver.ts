import ProjectConfig from '../../project/ProjectConfig';
import { COLOR_HEADER, COLOR_KEY_MESSAGE, COLOR_SUCCESS, COLOR_ERROR } from '@dxatscale/sfp-logger';
import SFPLogger, { LoggerLevel, Logger } from '@dxatscale/sfp-logger';
import _, { uniq } from 'lodash';
import semver = require('semver');
import convertBuildNumDotDelimToHyphen from '../../utils/VersionNumberConverter';
import { Connection } from '@salesforce/core';
import UserDefinedExternalDependencyMap from '../../project/UserDefinedExternalDependency';

export default class TransitiveDependencyResolver {
    constructor(private sfdxProjectConfig: any, private logger?: Logger) {}

    public async resolveTransitiveDependencies(): Promise<Map<string, { package: string; versionNumber?: string }[]>> {
        SFPLogger.log('Validating Project Dependencies...', LoggerLevel.INFO, this.logger);

        let clonedProjectConfig = await _.cloneDeep(this.sfdxProjectConfig);
        clonedProjectConfig = await new UserDefinedExternalDependencyMap().cleanupEntries(clonedProjectConfig);
        let pkgWithDependencies = ProjectConfig.getAllPackagesAndItsDependencies(clonedProjectConfig);
        pkgWithDependencies = this.fillDepsWithUserDefinedExternalDependencyMap(
            pkgWithDependencies,
            new UserDefinedExternalDependencyMap().fetchDependencyEntries(clonedProjectConfig)
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
                pkgWithDependencies.set(pkg, externalDependencyMap[pkg]);
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
                    dependenencies = dependenencies.concat(dependencyMap.get(dependency.package));
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
            for (let j = 0; j < uniqueDependencies.length; j++) {
                if (uniqueDependencies[j].versionNumber) {
                    let version = convertBuildNumDotDelimToHyphen(uniqueDependencies[j].versionNumber);

                    for (let i = j + 1; i < uniqueDependencies.length; i++) {
                        if (uniqueDependencies[j].package == uniqueDependencies[i].package) {
                            let versionToCompare = convertBuildNumDotDelimToHyphen(uniqueDependencies[i].versionNumber);
                            // replace existing packageInfo if package version number is newer
                            if (semver.lt(version, versionToCompare)) {
                               uniqueDependencies = this.swapAndDropArrayElement(uniqueDependencies,j,i);
                                
                            } else {
                                uniqueDependencies.splice(i, 1);
                                i--;
                            }
                        }
                    }
                }
                //do a dedup again
                uniqueDependencies = [
                    ...new Set(uniqueDependencies.map((objects) => JSON.stringify(objects))),
                ].map((tmpString) => JSON.parse(tmpString));
            }
            dependencyMap.set(pkg, uniqueDependencies);
        }
        return dependencyMap;
    }

    private swapAndDropArrayElement<T>(arr: T[], i: number, j: number): T[] {
        if (i < 0 || i >= arr.length || j < 0 || j >= arr.length) {
          return arr;
        }
        
        let newArr = [...arr];
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
        return [...newArr.slice(0, j), ...newArr.slice(j + 1)];
      }
      
      
}
