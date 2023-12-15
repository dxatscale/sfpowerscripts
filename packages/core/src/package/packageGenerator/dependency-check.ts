import { Logger } from '@salesforce/core';
import {PackageCharacter} from './types'
import SFPLogger, { LoggerLevel, COLOR_KEY_VALUE, COLOR_TRACE,COLOR_ERROR } from '@dxatscale/sfp-logger';

export default class DependencyCheck {
  public async run(tagMap: Map<string, string[]>, packageCharacterMap: Map<string, PackageCharacter>): Promise<void> {
    SFPLogger.log(
      COLOR_KEY_VALUE(
        'Now check the packages with dependency changes. The result determines the order in the unlocked build job.',
      ),LoggerLevel.INFO,
    )

    for (const [packageName, packageCharacter] of packageCharacterMap) {
      // check only when depenedency changes are found
      if (packageCharacter.hasDepsChanges) {
        SFPLogger.log(COLOR_TRACE(`Found dependency changes for package ${packageName}. Checking latest tags...`),LoggerLevel.TRACE)

        // check the git tags for deps version
        for (const depsTree of packageCharacter.packageDeps) {
          let foundVersionInTag = false
          const latestRegex = /^(\d+\.\d+\.\d+)/ // fetch version from dependency tree
          const treeMatch = depsTree.versionNumber?.match(latestRegex)
          if (treeMatch && treeMatch[1]) {
            for (const tag of tagMap.get(depsTree.package)!) {
              const tagRegex = new RegExp(`${depsTree.package}_v(\\d+\\.\\d+\\.\\d+)`)
              const tagMatch = tag.match(tagRegex)
              if (tagMatch && tagMatch[1]) {
                if (tagMatch[1] === treeMatch[1]) {
                  foundVersionInTag = true
                }
              }
            }
            // no latest version in tag , so now check the other pck in build job
            if (!foundVersionInTag) {
              if (packageCharacterMap.has(depsTree.package)) {
                const nextRegex = /^(\d+\.\d+\.\d+)/ // fetch version from dependency tree
                const characterMatch = packageCharacterMap.get(depsTree.package!)?.versionNumber.match(nextRegex)
                if (characterMatch && characterMatch[1]) {
                  if (characterMatch[1] === treeMatch[1]) {
                    packageCharacter.buildDeps.push(depsTree.package!)
                    SFPLogger.log(COLOR_TRACE(`⏹ Package ${packageName} depends on changes for other packages`),LoggerLevel.TRACE)
                    SFPLogger.log(
                      COLOR_TRACE(`⏹ So this package ${packageName} will be build after package ${depsTree.package}`),LoggerLevel.TRACE
                    )
                  } else {
                    packageCharacter.hasError = true
                    packageCharacter.errorMessages =
                      `Found no tag for package ${depsTree.package} with the version ${depsTree.versionNumber} as a dependency for package ${packageName}. Please check the sfdx-project.json file for this package/version.`      
                  }
                }
              } else {
                packageCharacter.hasError = true
                packageCharacter.errorMessages =
                  `Found no tag for package ${depsTree.package} with the version ${depsTree.versionNumber} as a dependency for package ${packageName}. Please check the sfdx-project.json file for this package/version.`
              }
            }
          } else {
            packageCharacter.hasError = true
            packageCharacter.errorMessages =
              `Please check for package ${packageName} the dependend package ${depsTree.package} version ${depsTree.versionNumber} in the sfdx-project.json file. It has a wrong format!`
          }
        }
      } else {
        continue
      }
    }
  }
}
