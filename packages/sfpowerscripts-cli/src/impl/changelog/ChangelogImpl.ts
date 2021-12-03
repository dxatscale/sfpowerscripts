import simplegit, { SimpleGit } from "simple-git";
import ArtifactFilePathFetcher, { ArtifactFilePaths } from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import { ReleaseChangelog } from "./ReleaseChangelogInterfaces";
import ChangelogMarkdownGenerator from "./ChangelogMarkdownGenerator";
import ReleaseChangelogUpdater from "./ReleaseChangelogUpdater";
import * as fs from "fs-extra"
import path = require('path');
const tmp = require('tmp');
var marked = require('marked');
var TerminalRenderer = require('marked-terminal');
const retry = require("async-retry");
import { GitError } from "simple-git";
import GitIdentity from "../git/GitIdentity";

marked.setOptions({
  // Define custom renderer
  renderer: new TerminalRenderer()
});

export default class ChangelogImpl {

  constructor(
    private artifactDir: string,
    private releaseName: string,
    private workItemFilter: string,
    private limit: number,
    private workItemUrl: string,
    private showAllArtifacts: boolean,
    private forcePush: boolean,
    private branch:string,
    private isDryRun:boolean,
    private org?: string,
  ){
    this.org = org?.toLowerCase();
  }

  async exec(): Promise<ReleaseChangelog> {
    return retry(async (bail, retryNum) => {
      try {
        return await this.execHandler();
      } catch (err) {
        if (err instanceof GitError) {
          if (!err.message.includes('failed to push some refs')) {
            // Do not retry for Git errors that are not related to push
            bail(err);
          } else {
            console.log("Failed to push changelog");
            console.log(`Retrying...(${retryNum})`);
            throw err;
          }
        } else {
          // Do not retry for non-Git errors
          bail(err);
        }
      }
    }, {
      retries: 10,
      minTimeout: 5,
      randomize: true
    });
  }

  private async execHandler() {
    let tempDir = tmp.dirSync({ unsafeCleanup: true });

    try {
      let artifact_filepaths: ArtifactFilePaths[] = ArtifactFilePathFetcher.fetchArtifactFilePaths(
        this.artifactDir
      );

      if (artifact_filepaths.length === 0) {
        throw new Error(`No artifacts found at ${path.resolve(process.cwd(), this.artifactDir)}`);
      }

      let artifactsToPackageMetadata: { [p: string]: PackageMetadata; } = {};
      let packagesToChangelogFilePaths: { [p: string]: string; } = {};
      let artifactSourceBranch: string;
      for (let artifactFilepaths of artifact_filepaths) {
        let packageMetadata: PackageMetadata = JSON.parse(
          fs.readFileSync(artifactFilepaths.packageMetadataFilePath, 'utf8')
        );

        artifactsToPackageMetadata[packageMetadata.package_name] = packageMetadata;
        packagesToChangelogFilePaths[packageMetadata.package_name] = artifactFilepaths.changelogFilePath;

        if (artifactSourceBranch == null) {
          if (packageMetadata.branch) {
            artifactSourceBranch = packageMetadata.branch;
          } else {
            console.log(`${packageMetadata.package_name} artifact is missing branch information`);
            console.log(`This will cause an error in the future. Re-create the artifact using the latest version of sfpowerscripts to maintain compatibility.`);
          }
        } else if (artifactSourceBranch !== packageMetadata.branch) {
          // TODO: throw error
          console.log("Artifacts must be created from the same branch");
        }
      }

      if (!artifactSourceBranch)
        throw new Error("Atleast one artifact must carry branch information");

      const repoTempDir = tempDir.name;

      // Copy source directory to temp dir
      fs.copySync(process.cwd(), repoTempDir);

      let git: SimpleGit = simplegit(repoTempDir);
      // Update local refs from remote
      await git.fetch("origin");


      console.log(`Checking out branch ${this.branch}`);
      if (await this.isBranchExists(this.branch, git)) {
        await git.checkout(this.branch);

        // For ease-of-use when running locally and local branch exists
        await git.merge([`refs/remotes/origin/${this.branch}`]);
      } else {
        await git.checkout(['-b', this.branch]);
      }

      let releaseChangelog: ReleaseChangelog;
      if (fs.existsSync(path.join(repoTempDir, `releasechangelog.json`))) {
        releaseChangelog = JSON.parse(fs.readFileSync(path.join(repoTempDir, `releasechangelog.json`), 'utf8'));
      } else {
        releaseChangelog = {
          orgs: [],
          releases: []
        };
      }

      console.log("Generating changelog...");

      releaseChangelog = new ReleaseChangelogUpdater(
        releaseChangelog,
        this.releaseName,
        artifactsToPackageMetadata,
        packagesToChangelogFilePaths,
        this.workItemFilter,
        this.org
      ).update();

      // Preview changelog in console
      console.log(
        marked(
          new ChangelogMarkdownGenerator(
            releaseChangelog,
            this.workItemUrl,
            1,
            false
          ).generate()
        )
      );

      fs.writeFileSync(
        path.join(repoTempDir, `releasechangelog.json`),
        JSON.stringify(releaseChangelog, null, 4)
      );


      let payload: string = new ChangelogMarkdownGenerator(
        releaseChangelog,
        this.workItemUrl,
        this.limit,
        this.showAllArtifacts
      ).generate();

      fs.writeFileSync(
        path.join(repoTempDir, `Release-Changelog.md`),
        payload
      );

      if(!this.isDryRun)
       await this.pushChangelogToBranch(this.branch, git, this.forcePush);

      console.log(`Successfully generated changelog`);
      return releaseChangelog;
    } finally {
      tempDir.removeCallback();
    }
  }

  private async pushChangelogToBranch(branch: string, git: SimpleGit, isForce: boolean) {
    console.log("Pushing changelog files to", branch);

    await new GitIdentity(git).setUsernameAndEmail();
    await git.add([`releasechangelog.json`, `Release-Changelog.md`]);
    await git.commit(`[skip ci] Updated Changelog ${this.releaseName}`);

    if (isForce) {
      await git.push("origin", branch, [`--force`]);
    } else {
      await git.push("origin", branch);
    }
  }

  private async isBranchExists(branch: string, git: SimpleGit): Promise<boolean> {
    const listOfBranches = await git.branch(['-la']);

    return listOfBranches.all.find((elem) => elem.endsWith(branch)) ? true : false;
  }
}
