
import ProjectConfig from '../project/ProjectConfig';
import { COLOR_HEADER, COLOR_KEY_MESSAGE, COLOR_SUCCESS, COLOR_ERROR } from '@dxatscale/sfp-logger';
import QueryHelper from '../queryHelper/QueryHelper';
import { Connection } from '@salesforce/core';
const Table = require('cli-table');


export default class TransitiveDependencyResolver {

  private dependencyMap;
  private updatedprojectConfig: any

  constructor(
    private projectConfig: ProjectConfig,
    private conn: Connection 
    ){}
  public async exec(): Promise<ProjectConfig>{
    console.log('Validating Project Dependencies...')

    this.updatedprojectConfig = this.projectConfig

    this.dependencyMap = await this.getAllPackageDependencyMap(this.projectConfig);

    await this.validateDependency(this.dependencyMap, this.projectConfig)

    return this.updatedprojectConfig
     
  }

  private getAllPackageDependencyMap(projectConfig: any): {} {
    let pkgWithDependencies = {}
    let packages = projectConfig.packageDirectories
    for(let pkg of packages){
      if(pkg.dependencies){
        pkgWithDependencies[pkg.package] = pkg.dependencies
      }
    }
    return pkgWithDependencies
  }

  private async validateDependency(dependencyMap: any, projectConfig: any){
    let pkgs = Object.keys(dependencyMap)
    for ( let pkg of pkgs){
      console.log(
        COLOR_HEADER(`fetching dependencies for package:`),
        COLOR_KEY_MESSAGE(pkg)
      );
      let dependenencies = []
      for(let dependency of dependencyMap[pkg]){
        if(dependencyMap[dependency.package]){
          console.log(`pushing ${dependencyMap[dependency.package].length} dependencies from package ${dependency.package}`)
          for( let temp of dependencyMap[dependency.package]){
            dependenencies.push(temp)
          }          
        }else{
          console.log(`no dependency found for ${dependency.package} in the map`)
        }
        dependenencies.push(dependency)
      }
      //deduplicate dependency list
      let uniqueDependencies =  [...new Set(dependenencies.map(objects => JSON.stringify(objects)))].map(tmpString => JSON.parse(tmpString));
      dependencyMap[pkg] = uniqueDependencies
      console.log(this.printDependencyTable(uniqueDependencies).toString());
      //Update project config
      await this.UpdateProjectConfig(pkg, uniqueDependencies)

      //fetch dependency for external packages
      if(projectConfig.packageAliases && projectConfig.packageAliases[pkg] && projectConfig.packageAliases[pkg].startsWith('04t')){
        const packageDependencies = await this.ExternalPackageDependencyFetcher(projectConfig.packageAliases[pkg])
        console.log(packageDependencies)
        if(packageDependencies.length == uniqueDependencies.length){
          console.log('Dependencies verified')
        }else if(packageDependencies.length > uniqueDependencies.length ){
          console.log('Missing dependencies')
        }
      }

    }
  }

  private printDependencyTable(dependencies: any){
    let tableHead = ['Dependency', 'Version Number']
    let table = new Table({
      head: tableHead,
    });
    for (let dependency of dependencies){
      let item = [
        dependency.package,
        dependency.versionNumber? dependency.versionNumber:''
      ];

      table.push(item);
    }

    return table;

  }

  private async ExternalPackageDependencyFetcher(packageId: string){

    const query = `SELECT Dependencies FROM SubscriberPackageVersion WHERE Id='${packageId}'`;

    return await QueryHelper.query<{ Dependencies: any }>(query, this.conn, true);

  }

  private async UpdateProjectConfig(packageName: string, fixedDependencies: any){
    this.updatedprojectConfig.packageDirectories.map(pkg => { if(pkg.package == packageName){return Object.assign(pkg, {dependencies: fixedDependencies})}})
  }

  

}