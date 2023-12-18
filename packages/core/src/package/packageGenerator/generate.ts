import {SfProject, SfProjectJson} from '@salesforce/core'
import {ensureArray} from '@salesforce/ts-types'
import SFPLogger, { LoggerLevel, COLOR_KEY_VALUE, COLOR_TRACE } from '@dxatscale/sfp-logger';
import SFPOrg from '../../org/SFPOrg';


import {NamedPackageDirLarge, PackageCharacter} from './types'
import GitTags from './tags.js'
import DependencyCheck from './dependency-check.js'


import ValidateDiff from './validate.js'
export class BuildGeneration {
  private devHubAlias: string
  constructor(devHubAlias: string) {
    this.devHubAlias = devHubAlias
  }
  public async run(includeOnlyPackages: string[]): Promise<Map<string, PackageCharacter>> {
    SFPLogger.log(
      COLOR_KEY_VALUE(
        'Loop sfdx-project.json package trees to search for modified files or package tree changes in git...',
      ),LoggerLevel.INFO
    )

    const eventCommits = await getCommitsFromDevHub(this.devHubAlias);

    // get sfdx project.json
    const project = await SfProject.resolve()
    const projectJson: SfProjectJson = await project.retrieveSfProjectJson()
    const {packageAliases} = projectJson.getContents()
    const packageMap = new Map<string, PackageCharacter>()
   
    // first get all tags from the current branch

    const gitTags = new GitTags()
    const dependencyCheck = new DependencyCheck()
    const tagMap = await gitTags.getTagsFromCurrentBranch()

    // get all packages
    const contents = projectJson.getContents()

    const packageDirs: NamedPackageDirLarge[] = ensureArray(contents.packageDirectories)
    // create yaml files templates

    // first loop for changes detection
    const promises: Promise<void>[] = []
    for (const pck of packageDirs) {
      if (pck.ignoreOnStage && Array.isArray(pck.ignoreOnStage) && pck.ignoreOnStage.includes('build')) {
        SFPLogger.log(COLOR_TRACE(`👆 Package ${pck.package} is ignored on build stage. Skipping...`), LoggerLevel.INFO)
        continue
      }

      if(includeOnlyPackages.length > 0 && !includeOnlyPackages.includes(pck.package!)) {
        continue
      }

      const promise = processPackage(pck, packageAliases, packageMap, projectJson, tagMap)

      promises.push(promise)
    }

    await Promise.all(promises)

    await dependencyCheck.run(tagMap, packageMap)

   
    return packageMap
  }
}

async function getCommitsFromDevHub(devHubAlias: string): Promise<Map<string, string>>{
   const commitPackageMap = new Map<string, string>()
   let devhubOrg = await SFPOrg.create({ aliasOrUsername: this.packageCreationParams.devHub });
   let connection = devhubOrg.getConnection();
   let packageBatchList = await connection.autoFetchQuery<T>(
    `select Name,VersionFT__c,VersionEdgSit__c,VersionEwiSit__c,VersionPreProd__c,VersionProd__c from Package__c`
   );
   let packageList = packageBatchList.records ? packageBatchList.records : [];
   return commitPackageMap
}

async function processPackage(
  pck: NamedPackageDirLarge,
  packageAliases: {[k: string]: string} | undefined,
  packageMap: Map<string, PackageCharacter>,
  projectJson: SfProjectJson,
  tagMap: Map<string, string[]>,
): Promise<void> {
  const packageCharacter: PackageCharacter = {
    hasDepsChanges: false,
    hasManagedPckDeps: false,
    reason: '',
    type: '',
    versionNumber: '',
    packageDeps: [],
    packageId: '',
    path: pck.path,
    buildDeps: [],
    hasError: false,
    errorMessages: '',
    subscriberPackageId: '',
  }
  if (pck.ignoreOnStage && Array.isArray(pck.ignoreOnStage) && pck.ignoreOnStage.includes('build')) {
    return
  }

  // set version
  packageCharacter.versionNumber = pck.versionNumber ?? ''
  packageCharacter.packageId = packageAliases![pck.package!] ? packageAliases![pck.package!] : ''
  // check bit2win dependencies
  if (pck.dependencies && Array.isArray(pck.dependencies)) {
    for (const packageTreeDeps of pck.dependencies!) {
      if (packageAliases![packageTreeDeps.package] && packageAliases![packageTreeDeps.package].startsWith('04')) {
        packageCharacter.hasManagedPckDeps = true
      } else {
        packageCharacter.packageDeps.push(packageTreeDeps)
      }
    }
  }

  // check pck type
  if (pck.type ?? pck.type === 'data') {
    packageCharacter.type = 'data'
  } else if (packageAliases![pck.package!]) {
    packageCharacter.type = 'unlocked'
  } else {
    packageCharacter.type = 'source'
  }

  const gitTag = await ValidateDiff.getInstance().getLatestTag(pck.package!, tagMap)
  if (!gitTag) {
    packageCharacter.reason = 'No Tag/Version Found'
    packageMap.set(pck.package!, packageCharacter)
    return
  }

  const hasGitDiff = await ValidateDiff.getInstance().getGitDiff(gitTag, pck, projectJson)
  if (hasGitDiff) {
    packageCharacter.reason = 'Found change(s) in package'
    packageCharacter.tag = gitTag
    const hasPackageDepsChanges = await ValidateDiff.getInstance().getPackageTreeChanges(gitTag, pck, projectJson, true)
    packageCharacter.hasDepsChanges = hasPackageDepsChanges
    packageMap.set(pck.package!, packageCharacter)
    return
  }

  const hasPackageTreeChanges = await ValidateDiff.getInstance().getPackageTreeChanges(gitTag, pck, projectJson)
  if (hasPackageTreeChanges) {
    packageCharacter.reason = 'Package Descriptor Changed'
    packageCharacter.tag = gitTag
    const hasPackageDepsChanges = await ValidateDiff.getInstance().getPackageTreeChanges(gitTag, pck, projectJson, true)
    packageCharacter.hasDepsChanges = hasPackageDepsChanges
    packageMap.set(pck.package!, packageCharacter)
  }

}
