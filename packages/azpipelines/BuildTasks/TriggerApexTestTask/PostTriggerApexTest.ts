import tl = require("azure-pipelines-task-lib/task");
import path = require("path");
import * as fs from "fs-extra"

async function run() {
  let taskType = tl.getVariable("Release.ReleaseId") ? "Release" : "Build";
  let stagingDir: string = "";
  if (taskType == "Build") {
    stagingDir = path.join(
      tl.getVariable("build.artifactStagingDirectory"),
      ".testresults"
    );

    console.log(stagingDir);
  } else {
    stagingDir = path.join( tl.getVariable("agent.releaseDirectory"),".testresults");
    console.log(stagingDir);
  }

  publishTestResults(stagingDir);
}

function publishTestResults(resultsDir: string): void {
  //Check if these files have been already read for publishing using a file as a flag
  const duplicateCheckFile = path.join(resultsDir, ".duplicateFile");

  if (!fs.existsSync(duplicateCheckFile)) {
    //Check if any files exist in the staging directory
    const matchingTestResultsFiles: any = tl.findMatch(
      resultsDir,
      "*-junit.xml"
    );

    if (matchingTestResultsFiles && matchingTestResultsFiles.length > 0) {
      let taskType = tl.getVariable("Release.ReleaseId") ? "Release" : "Build";
      if (taskType == "Build") {
        tl.command(
          "artifact.upload",
          { artifactname: `Apex Test Results` },
          resultsDir
        );
      }

      let buildConfig="";
      let buildPlaform="";

      if(taskType == "Build")
      {
       buildConfig = tl.getVariable("BuildConfiguration");
       buildPlaform = tl.getVariable("BuildPlatform");
      }
      else
      {
        buildConfig = tl.getVariable("Release.DefinitionName");
        buildPlaform = tl.getVariable("Release.DefinitionEnvironmentId");
      }


      const testRunTitle = "Apex Test Run";

      const tp: tl.TestPublisher = new tl.TestPublisher("JUnit");


      tp.publish(
        matchingTestResultsFiles,
        "true",
        buildPlaform,
        buildConfig,
        testRunTitle,
        "true",
        "sfpowerscripts-apextests"
      );

      //Write a flag file causing other post jobs to skip
      fs.writeJSONSync(duplicateCheckFile, { testsPublished: true });
    }
  } else {
    console.log("Skipping Post Job as results are already publishedgi");
  }
}

run();
