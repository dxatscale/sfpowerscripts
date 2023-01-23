import ProjectConfig from '../project/ProjectConfig';
import { COLOR_HEADER, COLOR_KEY_MESSAGE, COLOR_SUCCESS, COLOR_ERROR } from '@dxatscale/sfp-logger';
import { Connection } from '@salesforce/core';
import SFPLogger, { LoggerLevel, Logger } from '@dxatscale/sfp-logger';
import _ from 'lodash';
import { captureRejectionSymbol } from 'events';
const Table = require('cli-table');

export default class TransitiveDependencyResolver {
    private dependencyMap;
    private updatedprojectConfig: any;
    private externalDependencyMap: any = {};

    constructor(private projectConfig: ProjectConfig, private conn: Connection, private logger?: Logger) {}
    public async resolveDependencies(): Promise<ProjectConfig> {
        SFPLogger.log('Validating Project Dependencies...', LoggerLevel.INFO, this.logger);

        this.updatedprojectConfig = _.cloneDeep(this.projectConfig);

        await this.fetchExternalDependencies(this.projectConfig);

        this.dependencyMap = await this.getAllPackageDependencyMap(this.projectConfig);

        await this.expandDependencies(this.dependencyMap, this.projectConfig);


        return this.updatedprojectConfig;
    }

    public getAllPackageDependencyMap(projectConfig: any): { [key: string]: Dependency[] } {
        let pkgWithDependencies = {};
        let packages = projectConfig.packageDirectories;
        for (let pkg of packages) {
            if (pkg.dependencies) {
                pkgWithDependencies[pkg.package] = pkg.dependencies;
            }
        }
        console.log(this.externalDependencyMap)
        if(this.externalDependencyMap){
            console.log(Object.keys(this.externalDependencyMap))
            for ( let pkg of Object.keys(this.externalDependencyMap)){
                pkgWithDependencies[pkg] = this.externalDependencyMap[pkg];
            }
        }
        console.log(pkgWithDependencies)
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
            SFPLogger.log(`Dependencies resolved  for ${pkg}`,LoggerLevel.INFO,this.logger)
            SFPLogger.log(this.printDependencyTable(uniqueDependencies).toString(), LoggerLevel.INFO,this.logger);
            //Update project config
            await this.updateProjectConfig(pkg, uniqueDependencies);

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

    public async fetchExternalDependencies(projectConfig: any) {
        if (projectConfig?.plugins?.sfpowerscripts?.transitiveDependencyResolver?.externalDependencies){
            console.log(projectConfig.plugins.sfpowerscripts.transitiveDependencyResolver.externalDependencies)
            this.externalDependencyMap =  projectConfig.plugins.sfpowerscripts.transitiveDependencyResolver.externalDependencies;
            console.log(this.externalDependencyMap)
        }
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
