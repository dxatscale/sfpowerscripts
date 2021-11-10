import GitTags from "@dxatscale/sfpowerscripts.core/lib/git/GitTags";
import Git from "@dxatscale/sfpowerscripts.core/lib/git/Git";



export class LatestGitTagVersion
{
  constructor(private git:Git)
  {
  }

  public async getVersionFromLatestTag(
    packageName: string
  ): Promise<string> {
    let version: string;
  
    let gitTags = new GitTags(this.git, packageName);
    let tags = await gitTags.listTagsOnBranch();
    let latestTag = tags.pop();
  
    if (latestTag) {
      let match: RegExpMatchArray = latestTag.match(
        /^.*_v(?<version>[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+|\.LATEST|\.NEXT)?)$/
      );
      if (match)
        version = this.substituteBuildNumberWithPreRelease(
          match.groups.version
        );
      else throw new Error(`Failed to find valid tag for ${packageName}`);
    } else throw new Error(`Failed to find latest tag for ${packageName}`);
  
    return version;
  }
  
  private substituteBuildNumberWithPreRelease(packageVersionNumber: string) {
    let segments = packageVersionNumber.split(".");
  
    if (segments.length === 4) {
      packageVersionNumber = segments.reduce(
        (version, segment, segmentsIdx) => {
          if (segmentsIdx === 3) return version + "-" + segment;
          else return version + "." + segment;
        }
      );
    }
  
    return packageVersionNumber;
  }
}

