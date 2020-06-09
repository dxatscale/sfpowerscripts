import tl = require("azure-pipelines-task-lib/task");
import FileSystemInteractions from "../Common/FileSystemInteractions";
import  AnalyzeWithPMDImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/AnalyzeWithPMDImpl"
const os = require("os");
const path = require("path");
import xml2js = require("xml2js");
const fs = require("fs");

async function run() {
  try {
    console.log("Test.. PMD");

    let taskType = tl.getVariable("Release.ReleaseId") ? "Release" : "Build";
    let stagingDir: string = "";

    if (taskType == "Build") {
      stagingDir = path.join(
        tl.getVariable("build.artifactStagingDirectory"),
        ".codeAnalysis"
      );

      tl.debug("Build Staging Dir")
      tl.debug(stagingDir);
    } else {
      stagingDir = path.join(".codeAnalysis");
      tl.debug("Release Staging Dir")
      tl.debug(stagingDir);
    }

    const project_directory = tl.getInput("project_directory", false);
    const directory: string = tl.getInput("directory", false);
    const ruleset: string = tl.getInput("ruleset", false);



    let rulesetpath=""
    if (ruleset == "Custom") {
      let rulesetpath = tl.getInput("rulesetpath", false);
      console.log(rulesetpath);
    }

   

    const format: string = tl.getInput("format", false);
    const outputPath: string = tl.getInput("outputPath", false);
    const version: string = tl.getInput("version", false);

    const isToBreakBuild = tl.getBoolInput("isToBreakBuild", false);

    let result: [number, number, number] = [0, 0, 0];

    let pmdImpl: AnalyzeWithPMDImpl = new AnalyzeWithPMDImpl(
      project_directory,
      directory,
      rulesetpath,
      format,
      outputPath,
      version
    );
    let command = await pmdImpl.buildExecCommand();
    await pmdImpl.exec(command);

    if (taskType == "Build") {
      let artifactFilePath = path.join(
        os.homedir(),
        "sfpowerkit",
        "pmd",
        `pmd-bin-${version}`,
        "sf-pmd-output.xml"
      );

      tl.debug(`Artifact File Path : ${artifactFilePath}`);

      if (fs.existsSync(artifactFilePath)) {
        result = parseXmlReport(artifactFilePath);
      }

      if (result != null) {
        let summary = createSummaryLine(result);
        let buildSummaryFilePath: string = path.join(
          stagingDir,
          "CodeAnalysisBuildSummary.md"
        );
        FileSystemInteractions.createDirectory(stagingDir);
        fs.writeFileSync(buildSummaryFilePath, summary);

        tl.command(
          "task.addattachment",
          {
            type: "Distributedtask.Core.Summary",
            name: "Static Analysis with PMD"
          },
          buildSummaryFilePath
        );

        tl.command(
          "artifact.upload",
          { artifactname: `Code Analysis Results` },
          artifactFilePath
        );

        //add attachement
        tl.command(
          "task.addattachment",
          {
            type: `pmd_analysis_results`,
            name: `sfpowerscripts_pmd_analysis_results`
          },
          artifactFilePath
        );

        if (isToBreakBuild && result[2] > 0)
          tl.setResult(
            tl.TaskResult.Failed,
            `Build Failed due to ${result[2]} critical defects found`
          );
      }
    }
  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

function parseXmlReport(xmlReport: string): [number, number, number] {
  let fileCount = 0;
  let violationCount = 0;
  let criticaldefects = 0;

  let reportContent: string = fs.readFileSync(xmlReport, "utf-8");
  xml2js.parseString(reportContent, (err, data) => {
    // If the file is not XML, or is not from PMD, return immediately
    if (!data || !data.pmd) {
      console.debug(`Empty or unrecognized PMD xml report ${xmlReport}`);
      return null;
    }

    if (!data.pmd.file || data.pmd.file.length === 0) {
      // No files with violations, return now that it has been marked for upload
      return null;
    }

    data.pmd.file.forEach((file: any) => {
      if (file.violation) {
        fileCount++;
        violationCount += file.violation.length;
      }
    });

    for (let i = 0; i < data.pmd.file.length; i++) {
      data.pmd.file[i].violation.forEach(element => {
        if (element["$"]["priority"] == 1) {
          criticaldefects++;
        }
      });
    }
  });

  return [violationCount, fileCount, criticaldefects];
}

// For a given code analysis tool, create a one-line summary from multiple AnalysisResult objects.
function createSummaryLine(analysisreport: [number, number, number]): string {
  let violationCount: number = analysisreport[0];
  let affectedFileCount: number = analysisreport[1];
  let criticaldefects: number = analysisreport[2];
  let toolName = "PMD";

  if (violationCount > 1) {
    if (affectedFileCount > 1) {
      // Looks like: 'PMD found 13 violations in 4 files.'
      return `${toolName} found ${violationCount} violations in ${affectedFileCount} files with ${criticaldefects} criticaldefects`;
    }
    if (affectedFileCount === 1) {
      // Looks like: 'PMD found 13 violations in 1 file.'
      return `${toolName} found ${violationCount} violations in 1 file with ${criticaldefects} criticaldefects`;
    }
  }
  if (violationCount === 1 && affectedFileCount === 1) {
    // Looks like: 'PMD found 1 violation in 1 file.'
    return `${toolName} found 1 violation in 1 file with ${criticaldefects} criticaldefects`;
  }
  if (violationCount === 0) {
    // Looks like: 'PMD found no violations.'
    return `${toolName} found no violations.`;
  }

  // There should be no valid code reason to reach this point - '1 violation in 4 files' is not expected
  throw new Error(
    "Unexpected results from " +
      toolName +
      ": " +
      violationCount +
      " total violations in " +
      affectedFileCount +
      " files"
  );
}

run();
