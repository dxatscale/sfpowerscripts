import tl = require("azure-pipelines-task-lib/task");
import child_process = require("child_process");
import { onExit } from "@dxatscale/sfpowerscripts.core/lib/utils/OnExit";
import { getWebAPIWithoutToken } from "../Common/WebAPIHelper";
import { IReleaseApi } from "azure-devops-node-api/ReleaseApi";
import { Release, Artifact } from "azure-devops-node-api/interfaces/ReleaseInterfaces";
import ArtifactFilePathFetcher, { ArtifactFilePaths } from "../Common/ArtifactFilePathFetcher";
import fs = require("fs");

async function run() {
  try {
    console.log("sfpowerscripts... Generate Changelog.......");

    //WebAPI Initialization
    const webApi = await getWebAPIWithoutToken();
    const releaseApi: IReleaseApi = await webApi.getReleaseApi();

    let project: string = tl.getVariable('System.TeamProject');
    let releaseId: number = parseInt(tl.getVariable('Release.ReleaseId'), 10);
    console.log(project);
    console.log(releaseId);
    let release: Release = await releaseApi.getRelease(project, releaseId);
    console.log(release.artifacts);

    for (let artifact of release.artifacts) {
      let artifactFilePathFetcher = new ArtifactFilePathFetcher(artifact.alias, artifact.type);
      let artifacts_filepaths: ArtifactFilePaths[] = artifactFilePathFetcher.fetchArtifactFilePaths();
      console.log('artifact filepaths', artifacts_filepaths[0]);
      // Parse artifact metadata json to retrieve version number & commit Id
      let artifactMetadata: any = JSON.parse(
        fs.readFileSync(artifacts_filepaths[0].packageMetadataFilePath, 'utf8')
      );

      console.log(artifactMetadata.package_name);
      console.log(artifactMetadata.package_version_number);
      console.log(artifactMetadata.sourceVersion);
    }
    // let child=child_process.exec(command,  { cwd: working_directory,encoding: "utf8" },(error,stdout,stderr)=>{

    //   if(error)
    //      throw error;
    // });

    // child.stdout.on("data",data=>{console.log(data.toString()); });

    // await onExit(child);
    tl.setResult(tl.TaskResult.Succeeded, 'Finished');

  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}



run();
