
import ProjectConfig from '../project/ProjectConfig';
import { COLOR_HEADER, COLOR_KEY_MESSAGE, COLOR_SUCCESS, COLOR_ERROR } from '@dxatscale/sfp-logger';
const Table = require('cli-table');


export default class TransitiveDependencyResolver {

  private dependencyMap;

  constructor(private projectConfig: ProjectConfig ){}
  public async exec(): Promise<ProjectConfig>{
    console.log('Validating Project Dependencies...')

    this.dependencyMap = await this.getAllPackageDependencyMap(this.projectConfig);

    await this.validateDependency(this.dependencyMap)

    return this.dependencyMap
     
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

  private validateDependency(dependencyMap: any){
    let pkgs = Object.keys(dependencyMap)
    for ( let pkg of pkgs){
      console.log(
        COLOR_HEADER(`fetching dependencies for package:`),
        COLOR_KEY_MESSAGE(pkg)
      );
      let dependenencies = []
      for(let dependency of dependencyMap[pkg]){
        dependenencies.push(dependency)
        if(dependencyMap[dependency.package]){
          console.log(`pushing ${dependencyMap[dependency.package].length} dependencies from package ${dependency.package}`)
          for( let temp of dependencyMap[dependency.package]){
            dependenencies.push(temp)
          }          
        }else{
          console.log(`no dependency found for ${dependency.package}`)
        }
      }
      //deduplicate dependency list
      let uniqueDependencies =  [...new Set(dependenencies.map(objects => JSON.stringify(objects)))].map(tmpString => JSON.parse(tmpString));
      dependencyMap[pkg] = uniqueDependencies
      console.log(this.printDependencyTable(uniqueDependencies).toString());

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
  

}