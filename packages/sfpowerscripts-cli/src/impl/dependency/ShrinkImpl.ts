import ProjectConfig from '@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig';
import TransitiveDependencyResolver from '@dxatscale/sfpowerscripts.core/lib/package/dependencies/TransitiveDependencyResolver';
import { COLOR_HEADER, COLOR_KEY_MESSAGE, COLOR_SUCCESS, COLOR_ERROR } from '@dxatscale/sfp-logger';
import SFPLogger, { LoggerLevel, Logger } from '@dxatscale/sfp-logger';
import _ from 'lodash';
import { Connection } from '@salesforce/core';
const Table = require('cli-table');

export default class ShrinkImpl {
    private dependencyMap;
    private updatedprojectConfig: any;
    private externalDependencyMap: any = {};

    constructor(private projectConfig: ProjectConfig,private connToDevHub:Connection, private logger?: Logger) {}
    public async resolveDependencies(): Promise<ProjectConfig> {
        SFPLogger.log('Shrinking Project Dependencies...', LoggerLevel.INFO, this.logger);

        this.updatedprojectConfig = _.cloneDeep(this.projectConfig);
        
        const transitiveDependencyResolver = new TransitiveDependencyResolver(
          this.projectConfig,
          this.connToDevHub
        );

        this.externalDependencyMap =  ProjectConfig.fetchUserDefinedExternalDependencies(this.projectConfig);
        this.dependencyMap = await transitiveDependencyResolver.getAllPackageDependencyMap(this.updatedprojectConfig);
        await this.shrinkDependencies(this.dependencyMap);


        return this.updatedprojectConfig;
    }

    private async shrinkDependencies(dependencyMap: any) {
        let pkgs = Object.keys(dependencyMap);
        for (let pkg of pkgs) {
            SFPLogger.log(
                COLOR_HEADER(`cleaning up dependencies for package:`) + COLOR_KEY_MESSAGE(pkg),
                LoggerLevel.TRACE,
                this.logger
            );
            let dependenencies = dependencyMap[pkg];
            let updatedDependencies = _.cloneDeep(dependenencies);
            for (let dependency of dependencyMap[pkg]) {
                if (dependencyMap[dependency.package]) {
                    SFPLogger.log(
                        `Shrinking ${dependencyMap[dependency.package].length} dependencies from package ${
                            dependency.package
                        }`,
                        LoggerLevel.TRACE,
                        this.logger
                    );
                    for (let temp of dependencyMap[dependency.package]) {
                        for (let i = 0; i < updatedDependencies.length; i++) {
                            if(updatedDependencies[i].package == temp.package){
                                updatedDependencies.splice(i,1)
                            }
                          }
                    }
                } else {
                    SFPLogger.log(
                        `no dependency found for ${dependency.package} in the map`,
                        LoggerLevel.TRACE,
                        this.logger
                    );
                }
            }
            SFPLogger.log(`Dependencies resolved for ${pkg}`,LoggerLevel.INFO,this.logger)
            SFPLogger.log(this.printDependencyTable(updatedDependencies).toString(), LoggerLevel.INFO,this.logger);
            //Update project config
            await this.updateProjectConfig(pkg, updatedDependencies);
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

    private async updateProjectConfig(packageName: string, fixedDependencies: any) {
        this.updatedprojectConfig.packageDirectories.map((pkg) => {
            if (pkg.package == packageName) {
                return Object.assign(pkg, { dependencies: fixedDependencies });
            }
        });
    }
}

