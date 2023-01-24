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
        if(this.externalDependencyMap){
            for ( let pkg of Object.keys(this.externalDependencyMap)){
                pkgWithDependencies[pkg] = this.externalDependencyMap[pkg];
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
            for (var j = 0; j < uniqueDependencies.length; j++){
                if(uniqueDependencies[j].package == 'core'){
                }
                if(uniqueDependencies[j].versionNumber){
                    var version = uniqueDependencies[j].versionNumber.split(".")
                    for(var i = j+1; i < uniqueDependencies.length; i++){
                        if(uniqueDependencies[j].package == uniqueDependencies[i].package){
                            var versionToCompare = uniqueDependencies[i].versionNumber.split(".")
                            if(version[0] < versionToCompare[0]
                                || version[1] < versionToCompare[1]
                                || version[2] < versionToCompare[2]){
                                    uniqueDependencies[j] = uniqueDependencies[i]
                                }
                            uniqueDependencies.splice(i,1)
                        }
                    }
                }
                
            }
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
            this.externalDependencyMap =  projectConfig.plugins.sfpowerscripts.transitiveDependencyResolver.externalDependencies;
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
