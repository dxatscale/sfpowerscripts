import * as fs from "fs-extra";
import Git from "@dxatscale/sfpowerscripts.core/lib/git/Git";
import ReleaseDefinitionSchema from "../release/ReleaseDefinitionSchema";
import FetchArtifactsError from "../../errors/FetchArtifactsError";
import * as rimraf from "rimraf";
import FetchArtifactSelector from "./FetchArtifactSelector";
import { LatestGitTagVersion } from "./LatestGitTagVersion";

export default class FetchImpl {
  constructor(
    private releaseDefinition: ReleaseDefinitionSchema,
    private artifactDirectory: string,
    private scriptPath: string,
    private isNpm: boolean,
    private scope: string,
    private npmrcPath: string
  ) {}

  async exec(): Promise<{
    success: [string, string][];
    failed: [string, string][];
  }> {
    //Create Artifact Directory
    rimraf.sync("artifacts");
    fs.mkdirpSync("artifacts");

    let fetchedArtifacts: {
      success: [string, string][];
      failed: [string, string][];
    };

      fetchedArtifacts = await this.fetchArtifacts(
        this.releaseDefinition,
        this.artifactDirectory,
        this.scriptPath,
        this.scope,
        this.npmrcPath
      );
    

    return fetchedArtifacts;
  }

  private async fetchArtifacts(
    releaseDefinition: ReleaseDefinitionSchema,
    artifactDirectory: string,
    scriptPath:string,
    scope: string,
    npmrcPath: string
  ): Promise<{
    success: [string, string][];
    failed: [string, string][];
  }> {
   
    const git: Git = new Git(null);
    let latestGitTagVersion:LatestGitTagVersion = new LatestGitTagVersion(git);

    let fetchedArtifacts = {
      success: [],
      failed: [],
    };

    let artifacts: [string, string][];
    let i: number;
    try {
      artifacts = Object.entries(releaseDefinition.artifacts);
      for (i = 0; i < artifacts.length; i++) {
        let version: string;
        if (
          artifacts[i][1] === "LATEST_TAG" ||
          artifacts[i][1] === "LATEST_GIT_TAG"
        ) {
          version = await latestGitTagVersion.getVersionFromLatestTag(artifacts[i][0]);
        } else version = artifacts[i][1];

        let  artifactFetcher = new FetchArtifactSelector(scriptPath,scope,npmrcPath).getArtifactFetcher();  
        artifactFetcher.fetchArtifact(artifacts[i][0],artifactDirectory,version,false)
     
        fetchedArtifacts.success.push(artifacts[i]);
      }
    } catch (error) {
      console.log(error.message);
      fetchedArtifacts.failed = artifacts.slice(i);
      throw new FetchArtifactsError(
        "Failed to fetch artifacts",
        fetchedArtifacts,
        error
      );
    }

    return fetchedArtifacts;
  }


  
}
