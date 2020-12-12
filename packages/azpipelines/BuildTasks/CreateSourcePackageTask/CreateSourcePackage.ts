import tl = require("azure-pipelines-task-lib/task");
import PackageDiffImpl from "@dxatscale/sfpowerscripts.core/lib/package/PackageDiffImpl";
import CreateSourcePackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/CreateSourcePackageImpl";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import ArtifactGenerator from "@dxatscale/sfpowerscripts.core/lib/generators/ArtifactGenerator";



async function run() {
  try {
    let sfdx_package: string = tl.getInput("package", true);
    let version_number: string = tl.getInput("version_number", false);
    let isDiffCheck: boolean = tl.getBoolInput("isDiffCheck", false);
    let isGitTag: boolean = tl.getBoolInput("isGitTag", false);
    let projectDirectory: string = tl.getInput("project_directory", false);
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
        branch:tl.getVariable("build.sourceBranch")
      };

      //Convert to MDAPI
      let createSourcePackageImpl = new CreateSourcePackageImpl(
        projectDirectory,
        sfdx_package,
        null,
        packageMetadata
      );
      packageMetadata = await createSourcePackageImpl.exec();

      //Create Git Tag
      if (isGitTag) {
        let tagname: string = `${sfdx_package}_v${version_number}`;
        packageMetadata.tag = tagname;

        tl.setVariable(`${sfdx_package}_sfpowerscripts_git_tag`, tagname);
        if (projectDirectory == null)
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

      console.log("##[command]Package Metadata:"+JSON.stringify(packageMetadata,(key:string,value:any)=>{
         if(key=="payload" || key == "destructiveChanges")
           return undefined;
         else
            return value;
      }));



      let artifactFilepath: string = await ArtifactGenerator.generateArtifact(
        sfdx_package,
        projectDirectory,
        tl.getVariable("agent.tempDirectory"),
        packageMetadata
      );

      tl.uploadArtifact(`sfpowerscripts_artifacts`, artifactFilepath, `sfpowerscripts_artifacts`);


      tl.setVariable("sfpowerscripts_package_version_number", version_number);
      tl.setVariable(
        "sfpowerscripts_artifact_path",
        artifactFilepath
      );
    }
  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();
