import GitTags from "./GitTags";
import Git from './Git';

export default class GitTagPurgeList {

  constructor(private git: Git, private sfdx_package: string, private daysToKeep: number, private limit: number) {}

  async listTagsOnBranchToPurge(): Promise<string[]> {

    const gitTags: GitTags = new GitTags(this.git, this.sfdx_package);

    const tags = await gitTags.filteredOldTags(this.daysToKeep, this.limit)

    return tags.length > 0
    ? tags
    : [];
  }

}
