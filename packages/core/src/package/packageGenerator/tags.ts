import {SfProject, SfProjectJson, PackageDir} from '@salesforce/core'
import path from 'node:path'
import {SimpleGit, simpleGit} from 'simple-git'

import SFPLogger, { LoggerLevel, COLOR_KEY_VALUE, COLOR_TRACE } from '@dxatscale/sfp-logger';

import child_process = require('child_process')

export default class GitTags {

  public async getTagsFromCurrentBranch(): Promise<Map<string, string[]>> {
    SFPLogger.log(COLOR_KEY_VALUE('⏳ Getting tags from current branch...'),LoggerLevel.TRACE)
    const tagMap = new Map<string, string[]>() // key: tag, value: commit hash
    const project = await SfProject.resolve()
    const projectJson: SfProjectJson = await project.retrieveSfProjectJson()
    const git = simpleGit(path.dirname(projectJson.getPath()))
      
    // get all packages
    const packageDirs = projectJson.getContents().packageDirectories

    // Get full-length commit ID's on the current branch, following the first parent on merge commits
    const gitLogResult = await git.log([`--pretty=format:%H`])
    const commitHashes: string[] = gitLogResult?.all[0]?.hash?.split('\n')
    const promises: Promise<void>[] = []

    for (const pck of packageDirs) {
      const promise = this.listTagsOnBranch(pck.package!, commitHashes, git, tagMap, packageDirs)
      promises.push(promise)
    }

    SFPLogger.log(COLOR_TRACE(`⏳ Processed ${packageDirs.length} packages to find tags. Total length ${commitHashes.length} commit hashes on branch.`),LoggerLevel.INFO)

    await Promise.all(promises)

    return tagMap
  }

  private async listTagsOnBranch(
    pck: string,
    commitHashes: string[],
    git: SimpleGit,
    tagMap: Map<string, string[]>,
    packageDirs: PackageDir[]
  ): Promise<void> {
    try {

      const tagResult = await git.tag([`-l`, `${pck}_v*`, `--sort=creatordate`, `--merged`])
      const tags: string[] = tagResult?.split('\n') ?? []
      tags.pop()

      const refResult = child_process.execSync(`git show-ref --tags -d | grep "${pck}_v*"`, {
        cwd: process.cwd(),
        maxBuffer: 5 * 1024 * 1024,
        stdio: 'pipe',
      })

      const refResultString = refResult ? refResult.toString() : ''

      const refTags = refResultString ? refResultString.split('\n') : []
      refTags.pop()
      // By checking whether all 40 digits in the tag commit ID matches an ID in the branch's commit log
      let refTagsPointingToBranch: string[] = refTags.filter((refTag) => commitHashes.includes(refTag.slice(0, 40)))

      // Only match the name of the tags pointing to the branch
      refTagsPointingToBranch = refTagsPointingToBranch.map((refTagPointingToBranch) => {
        const match = refTagPointingToBranch.match(/refs\/tags\/(.*)((?:-ALIGN)|(?:\^{}))/)
        if (match && match[1] !== null) {
          return match[1]
        }

        return ''
      })

      // Filter the sorted tags - only including tags that point to the branch
      const tagsPointingToBranch: string[] = tags.filter((tag) => refTagsPointingToBranch.includes(tag))
      tagMap.set(pck, tagsPointingToBranch)
    } catch (error) {
      SFPLogger.log(COLOR_TRACE(`⏳ Find no tags for package ${pck}`),LoggerLevel.TRACE)
      tagMap.set(pck, [])
    }
  }
}
