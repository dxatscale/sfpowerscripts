import TransitiveDependencyResolver from '@dxatscale/sfpowerscripts.core/lib/package/dependencies/TransitiveDependencyResolver';
import { COLOR_HEADER, COLOR_KEY_MESSAGE, COLOR_SUCCESS, COLOR_ERROR } from '@dxatscale/sfp-logger';
import SFPLogger, { LoggerLevel, Logger } from '@dxatscale/sfp-logger';
import _ from 'lodash';
import { Connection } from '@salesforce/core';
const Table = require('cli-table');
import UserDefinedExternalDependency from '@dxatscale/sfpowerscripts.core/lib/project/UserDefinedExternalDependency';

export default class ShrinkImpl {
    private dependencyMap;
    private updatedprojectConfig: any;


    constructor(private connToDevHub:Connection, private logger?: Logger) {}
    public async shrinkDependencies(sfdxProjectConfig: any): Promise<any> {
        SFPLogger.log('Shrinking Project Dependencies...', LoggerLevel.INFO, this.logger);

        this.updatedprojectConfig = _.cloneDeep(sfdxProjectConfig);

        const transitiveDependencyResolver = new TransitiveDependencyResolver(
            sfdxProjectConfig
        );

        this.dependencyMap = await transitiveDependencyResolver.resolveTransitiveDependencies();
        await this.resolveAndShrinkDependencies(this.dependencyMap);

        this.updatedprojectConfig = new UserDefinedExternalDependency().addDependencyEntries(  this.updatedprojectConfig, this.connToDevHub);

        return this.updatedprojectConfig;
    }

    private async resolveAndShrinkDependencies(dependencyMap: any) {
        let pkgs = [...dependencyMap.keys()];

        for (let pkg of pkgs) {
            SFPLogger.log(
                COLOR_HEADER(`cleaning up dependencies for package:`) + COLOR_KEY_MESSAGE(pkg),
                LoggerLevel.TRACE,
                this.logger
            );
            let dependenencies = dependencyMap.get(pkg);
            let updatedDependencies = _.cloneDeep(dependenencies);
            for (let dependency of dependencyMap.get(pkg)) {
                if (dependencyMap.get(dependency.package)) {
                    SFPLogger.log(
                        `Shrinking ${dependencyMap.get(dependency.package).length} dependencies from package ${
                            dependency.package
                        }`,
                        LoggerLevel.TRACE,
                        this.logger
                    );
                    for (let temp of dependencyMap.get(dependency.package)) {
                        for (let i = 0; i < updatedDependencies.length; i++) {
                            if (updatedDependencies[i].package == temp.package) {
                                updatedDependencies.splice(i, 1);
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
            //Update project config
            await this.updateProjectConfig(pkg, updatedDependencies);
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

