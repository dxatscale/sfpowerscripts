import SFPLogger from '@dxatscale/sfp-logger';
import { Connection, LoggerLevel } from '@salesforce/core';
import _ from 'lodash';
import ExternalPackage2DependencyResolver from '../package/dependencies/ExternalPackage2DependencyResolver';

/**
 * Functions to deal with externalDependencyMap supplied by the user
 * to aid in resolving transitive dependencies
 */
export default class UserDefinedExternalDependencyMap {
   

    public  fetchDependencyEntries(projectConfig: any) {
        if (projectConfig.plugins?.sfpowerscripts?.externalDependencyMap) {
            let externalDependencyMap = projectConfig.plugins.sfpowerscripts.externalDependencyMap;
            SFPLogger.log(JSON.stringify(externalDependencyMap), LoggerLevel.DEBUG);
            return externalDependencyMap;
        }
        else
         return {};
    }

    public async addDependencyEntries(projectConfig: any, connToDevHub: Connection) {
        let externalDependencies = [];
        let updatedProjectConfig = await _.cloneDeep(projectConfig);
        let externalPackageResolver = new ExternalPackage2DependencyResolver(connToDevHub, projectConfig, null);

        let externalDependencyMap = this.fetchDependencyEntries(projectConfig);

        let externalPackage2s = await externalPackageResolver.resolveExternalPackage2DependenciesToVersions();

        for (let externalPackage2 of externalPackage2s) {
            externalDependencies.push(externalPackage2.name);
        }
        for (let dependency of externalDependencies) {
            if (!Object.keys(externalDependencyMap).includes(dependency)) {
                externalDependencyMap[dependency] = [{ package: '', versionNumber: '' }];
            }
        }
        updatedProjectConfig.plugins.sfpowerscripts.externalDependencyMap = externalDependencyMap;
        return updatedProjectConfig;
    }

    public async cleanupEntries(projectConfig: any) {
        let updatedProjectConfig = await _.cloneDeep(projectConfig);
        if (updatedProjectConfig?.plugins?.sfpowerscripts?.externalDependencyMap) {
            const externalDependencyMap = updatedProjectConfig.plugins.sfpowerscripts.externalDependencyMap;
            for (let externalPackage of Object.keys(externalDependencyMap)) {
                if (externalDependencyMap[externalPackage][0].package == '') {
                    delete externalDependencyMap[externalPackage];
                } else if (
                    externalDependencyMap[externalPackage][0].package != '' &&
                    externalDependencyMap[externalPackage][0].versionNumber == ''
                ) {
                    delete externalDependencyMap[externalPackage][0].versionNumber;
                }
            }
        }
        return updatedProjectConfig;
    }
}
