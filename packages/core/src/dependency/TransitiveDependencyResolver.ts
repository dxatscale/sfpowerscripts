import ProjectConfig from '../project/ProjectConfig';
import { COLOR_HEADER, COLOR_KEY_MESSAGE, COLOR_SUCCESS, COLOR_ERROR } from '@dxatscale/sfp-logger';
import QueryHelper from '../queryHelper/QueryHelper';
import { Connection } from '@salesforce/core';
import SFPLogger, { LoggerLevel, Logger } from '@dxatscale/sfp-logger';
import _ from 'lodash';
const Table = require('cli-table');

export default class TransitiveDependencyResolver {
    private dependencyMap;
    private updatedprojectConfig: any;

    constructor(private projectConfig: ProjectConfig, private conn: Connection, private logger?: Logger) {}
    public async resolveDependencies(): Promise<ProjectConfig> {
        SFPLogger.log('Validating Project Dependencies...', LoggerLevel.INFO, this.logger);

        this.updatedprojectConfig = _.cloneDeep(this.projectConfig);

        this.dependencyMap = await this.getAllPackageDependencyMap(this.projectConfig);

        await this.expandDependencies(this.dependencyMap, this.projectConfig);

        return this.updatedprojectConfig;
    }

    private getAllPackageDependencyMap(projectConfig: any): { [key: string]: Dependency[] } {
        let pkgWithDependencies = {};
        let packages = projectConfig.packageDirectories;
        for (let pkg of packages) {
            if (pkg.dependencies) {
                pkgWithDependencies[pkg.package] = pkg.dependencies;
            }
        }
        return pkgWithDependencies;
    }

    private async expandDependencies(dependencyMap: any, projectConfig: any) {
        let pkgs = Object.keys(dependencyMap);
        for (let pkg of pkgs) {
            SFPLogger.log(
                COLOR_HEADER(`fetching dependencies for package:`) + COLOR_KEY_MESSAGE(pkg),
                LoggerLevel.TRACE,
                this.logger
            );
            let dependenencies = [];
            for (let dependency of dependencyMap[pkg]) {
                if (dependencyMap[dependency.package]) {
                    SFPLogger.log(
                        `pushing ${dependencyMap[dependency.package].length} dependencies from package ${
                            dependency.package
                        }`,
                        LoggerLevel.TRACE,
                        this.logger
                    );
                    for (let temp of dependencyMap[dependency.package]) {
                        dependenencies.push(temp);
                    }
                } else {
                    SFPLogger.log(
                        `no dependency found for ${dependency.package} in the map`,
                        LoggerLevel.TRACE,
                        this.logger
                    );
                }
                dependenencies.push(dependency);
            }
            //deduplicate dependency list
            let uniqueDependencies = [
                ...new Set(dependenencies.map((objects) => JSON.stringify(objects))),
            ].map((tmpString) => JSON.parse(tmpString));
            dependencyMap[pkg] = uniqueDependencies;
            SFPLogger.log(this.printDependencyTable(uniqueDependencies).toString(), LoggerLevel.INFO);
            //Update project config
            await this.updateProjectConfig(pkg, uniqueDependencies);

            //fetch dependency for external packages
            if (
                projectConfig.packageAliases &&
                projectConfig.packageAliases[pkg] &&
                projectConfig.packageAliases[pkg].startsWith('04t')
            ) {
                const packageDependencies = await this.fetchExternalDependencies(projectConfig.packageAliases[pkg]);
                if (packageDependencies.length == uniqueDependencies.length) {
                    SFPLogger.log('Dependencies verified and fixed', LoggerLevel.TRACE, this.logger);
                } else if (packageDependencies.length > uniqueDependencies.length) {
                    SFPLogger.log(`Missing dependencies on pkg ${pkg}`, LoggerLevel.TRACE, this.logger);
                }
            }
        }
    }

    private printDependencyTable(dependencies: any) {
        let tableHead = ['Dependency', 'Version Number'];
        let table = new Table({
            head: tableHead,
        });
        for (let dependency of dependencies) {
            let item = [dependency.package, dependency.versionNumber ? dependency.versionNumber : ''];

            table.push(item);
        }

        return table;
    }

    private async fetchExternalDependencies(packageId: string) {
        const query = `SELECT Dependencies FROM SubscriberPackageVersion WHERE Id='${packageId}'`;

        return await QueryHelper.query<{ Dependencies: any }>(query, this.conn, true);
    }

    private async updateProjectConfig(packageName: string, fixedDependencies: any) {
        this.updatedprojectConfig.packageDirectories.map((pkg) => {
            if (pkg.package == packageName) {
                return Object.assign(pkg, { dependencies: fixedDependencies });
            }
        });
    }
}

interface Dependency {
    packagename: string;
    versionNumber: string;
}
