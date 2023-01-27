import ProjectConfig from '../project/ProjectConfig';
import { COLOR_HEADER, COLOR_KEY_MESSAGE, COLOR_SUCCESS, COLOR_ERROR } from '@dxatscale/sfp-logger';
import { Connection } from '@salesforce/core';
import SFPLogger, { LoggerLevel, Logger } from '@dxatscale/sfp-logger';
import _ from 'lodash';
import semver = require('semver');
import convertBuildNumDotDelimToHyphen from '../utils/VersionNumberConverter';
import QueryHelper from '../queryHelper/QueryHelper';
const Table = require('cli-table');

export default class TransitiveDependencyResolver {
    private dependencyMap;
    private updatedprojectConfig: any;
    private externalDependencyMap: any = {};
    private externalDependencies: Array<string> = []

    constructor(private sfdxProjectConfig: any, private conn: Connection, private logger?: Logger) {}
    public async resolveDependencies(): Promise<ProjectConfig> {
        SFPLogger.log('Validating Project Dependencies...', LoggerLevel.INFO, this.logger);

        this.updatedprojectConfig = _.cloneDeep(this.sfdxProjectConfig);

        await this.fetchExternalDependencies();

        this.dependencyMap = await this.getAllPackageDependencyMap();

        await this.expandDependencies(this.dependencyMap);


        return this.updatedprojectConfig;
    }

    public async getAllPackageDependencyMap(): Promise<{ [key: string]: Dependency[] }> {
        let pkgWithDependencies = {};
        let packages = ProjectConfig.getAllPackageDirectoriesFromConfig(this.sfdxProjectConfig);
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
        // identify external dependencies for the packages in package aliases
        for( let pkgAlias of Object.keys(this.sfdxProjectConfig.packageAliases)){
            var isInternalPackage = false
            for (let pkg of packages) {
                if( pkgAlias == pkg.package){
                    isInternalPackage = true
                    break
                }
            }
            if( !isInternalPackage){
                this.externalDependencies.push(pkgAlias)
            }            
        }

        if( this.externalDependencies.length > 0 ){
            SFPLogger.log(`Detected ${this.externalDependencies.length} External Dependencies`,LoggerLevel.INFO,this.logger)
            SFPLogger.log(this.printExternalDependencyTable(this.externalDependencies).toString(), LoggerLevel.INFO,this.logger);
            //Update project config
            await this.addExternalDependencyEntry();

        }
        return pkgWithDependencies;
    }

    private async expandDependencies(dependencyMap: any) {
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
                if(uniqueDependencies[j].versionNumber){
                    let version = convertBuildNumDotDelimToHyphen(uniqueDependencies[j].versionNumber);

                    for(var i = j+1; i < uniqueDependencies.length; i++){
                        if(uniqueDependencies[j].package == uniqueDependencies[i].package){
                            let versionToCompare = convertBuildNumDotDelimToHyphen(uniqueDependencies[i].versionNumber);
                            // replace existing packageInfo if package version number is newer
                            if (semver.lt(version, versionToCompare)) {
                                uniqueDependencies.splice(j,1)
                            }else{
                                uniqueDependencies.splice(i,1)
                            }
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

    private printExternalDependencyTable(externalDependencies: Array<string>) {
        let tableHead = ['External Dependency'];
        let table = new Table({
            head: tableHead,
        });
        for (let dependency of externalDependencies) {
            let item = [dependency];

            table.push(item);
        }

        return table;
    }

    public async fetchExternalDependencies() {
        if (this.sfdxProjectConfig.plugins?.sfpowerscripts?.externalDependencyMap){
            this.externalDependencyMap =  this.sfdxProjectConfig.plugins.sfpowerscripts.externalDependencyMap;
            SFPLogger.log(JSON.stringify(this.externalDependencyMap),LoggerLevel.DEBUG,this.logger);
        }
    }

    private async updateProjectConfig(packageName: string, fixedDependencies: any) {
        this.updatedprojectConfig.packageDirectories.map((pkg) => {
            if (pkg.package == packageName) {
                return Object.assign(pkg, { dependencies: fixedDependencies });
            }
        });
    }

    private async addExternalDependencyEntry() {
        for ( let dependency of this.externalDependencies){
            if (!Object.keys(this.externalDependencyMap).includes(dependency)){
                this.externalDependencyMap[dependency] = [{ "package": "", "versionNumber": ""}]
            }

        }
        this.updatedprojectConfig.plugins.sfpowerscripts.externalDependencyMap = this.externalDependencyMap
    }
}

interface Dependency {
    packagename: string;
    versionNumber: string;
}
