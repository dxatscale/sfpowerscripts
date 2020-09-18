import tl = require("azure-pipelines-task-lib/task");
import PackageDiffImpl from "@dxatscale/sfpowerscripts.core/lib/package/PackageDiffImpl";
import CreateSourcePackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/CreateSourcePackageImpl";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import ArtifactGenerator from "@dxatscale/sfpowerscripts.core/lib/generators/ArtifactGenerator"
import { isNullOrUndefined } from "util";


async function run() {
  try {
    let sfdx_package: string = tl.getInput("package", true);
    let version_number: string = tl.getInput("version_number", false);
    let isDiffCheck: boolean = tl.getBoolInput("isDiffCheck", false);
    let isGitTag: boolean = tl.getBoolInput("isGitTag", false);
    let projectDirectory: string = tl.getInput("project_directory", false);
    let apextestsuite = tl.getInput("apextestsuite", false);
    let destructiveManifestFilePath=tl.getInput("destructiveManifestFilepath",false);
    let commitId = tl.getVariable("build.sourceVersion");
    let repositoryUrl = tl.getVariable("build.repository.uri");

    let isRunBuild: boolean;
    if (isDiffCheck) {


      let packageDiffImpl = new PackageDiffImpl(
        sfdx_package,
        projectDirectory
      );

      isRunBuild = await packageDiffImpl.exec();

      if (isRunBuild)
        console.log(
          `Detected changes to ${sfdx_package} package...proceeding\n`
        );
      else
        console.log(
          `No changes detected for ${sfdx_package} package...skipping\n`
        );
    } else isRunBuild = true;

    if (isRunBuild) {


      //Create Metadata Artifact
      let packageMetadata:PackageMetadata = {
        package_name: sfdx_package,
        package_version_number: version_number,
        sourceVersion: commitId,
        repository_url: repositoryUrl,
        apextestsuite:apextestsuite
      };

      //Convert to MDAPI
      let createSourcePackageImpl = new CreateSourcePackageImpl(
        projectDirectory,
        sfdx_package,
        destructiveManifestFilePath,
        packageMetadata
      );
      packageMetadata = await createSourcePackageImpl.exec();

      if (packageMetadata.isApexFound && isNullOrUndefined(apextestsuite)) {
        tl.logIssue(
          tl.IssueType.Warning,
          "This package has apex classes/triggers and an apex test suite is not specified, You would not be able to deply to production if each class do not have coverage of 75% and above"
        );
      }

      console.log(JSON.stringify(packageMetadata));

      console.log("##[command]Package Metadata:"+JSON.stringify(packageMetadata,(key:string,value:any)=>{
         if(key=="payload" || key == "destructiveChanges")
           return undefined;
         else
            return value;
      }));



      let artifact= await ArtifactGenerator.generateArtifact(sfdx_package,projectDirectory,tl.getVariable("agent.tempDirectory"),packageMetadata);

      tl.uploadArtifact(`${sfdx_package}_sfpowerscripts_artifact`, artifact.artifactDirectory,`${sfdx_package}_sfpowerscripts_artifact`);




      tl.setVariable("sfpowerscripts_package_version_number", version_number);
      tl.setVariable(
        "sfpowerscripts_source_package_metadata_path",
       artifact.artifactMetadataFilePath
      );
      tl.setVariable(
        "sfpowerscripts_source_package_path",
        artifact.artifactSourceDirectory
      );


      //Create Git Tag
      if (isGitTag) {
        let tagname: string = `${sfdx_package}_v${version_number}`;
        tl.setVariable(`${sfdx_package}_sfpowerscripts_git_tag`, tagname);
        if (isNullOrUndefined(projectDirectory))
          tl.setVariable(
            `${sfdx_package}_sfpowerscripts_project_directory_path`,
            tl.getVariable("Build.Repository.LocalPath")
          );
        else
          tl.setVariable(
            `${sfdx_package}_sfpowerscripts_project_directory_path`,
            projectDirectory
          );
      }
    }
  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();
