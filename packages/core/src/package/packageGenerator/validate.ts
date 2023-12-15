import {SfError, SfProjectJson} from '@salesforce/core'

import {NamedPackageDirLarge} from './types'

import lodash from 'lodash'
import path from 'node:path'
import {simpleGit} from 'simple-git'

export default class ValidateDiff {
    private static instance: ValidateDiff
  
    public static getInstance(): ValidateDiff {
      if (!this.instance) {
        this.instance = new ValidateDiff()
      }
  
      return this.instance
    }
  
    public async getGitDiff(tag: string, packageTree: NamedPackageDirLarge, project: SfProjectJson): Promise<boolean> {
      const git = simpleGit(path.dirname(project.getPath()))
      const diffString = await git.diff([`${tag}`, `HEAD`, `--no-renames`, `--name-only`])
      const modifiedFiles: string[] = diffString.split('\n')
  
      modifiedFiles.pop()
  
      // no static checks when package is ignored
  
      for (const filename of modifiedFiles) {
        if (path.normalize(filename).includes(path.normalize(packageTree.path))) {
          return true
        }
      }
  
      return false
    }
  
    public async getLatestTag(pck: string, tagMap: Map<string, string[]>): Promise<string> {
      if(tagMap.has(pck) && tagMap.get(pck)?.length! > 0) {
        return tagMap.get(pck)?.at(-1) ?? ''
      }
  
      return ''
    }
  
    public async getPackageTreeChanges(
      tag: string,
      sourceTree: NamedPackageDirLarge,
      project: SfProjectJson,
      isDepsCheck: boolean = false,
    ): Promise<boolean> {
      const git = simpleGit(path.dirname(project.getPath()))
      const projectJsonString: string = await git.show([`${tag}:sfdx-project.json`])
      if (!projectJsonString) {
        throw new SfError(`Found no sfdx-project.json file for tag ${tag}`)
      }
  
      const projectJsonTarget = JSON.parse(projectJsonString)
      const packageDirsTarget = projectJsonTarget.packageDirectories
  
      if (!packageDirsTarget && !Array.isArray(packageDirsTarget)) {
        throw new SfError(`Could not parse sfdx-project.json from target branch. Please check your target branch.`)
      }
  
      if (isDepsCheck) {
        for (const targetTree of packageDirsTarget) {
          if (
            targetTree.package === sourceTree.package &&
            !lodash.isEqual(targetTree.dependencies, sourceTree.dependencies)
          ) {
            return true
          }
        }
      } else {
        for (const targetTree of packageDirsTarget) {
          if (targetTree.package === sourceTree.package && !lodash.isEqual(targetTree, sourceTree)) {
            return true
          }
        }
      }
  
      return false
    }
  }