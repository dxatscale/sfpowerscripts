import tl = require("azure-pipelines-task-lib/task");
import CreateUnlockedPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/CreateUnlockedPackageImpl";
import PackageDiffImpl from "@dxatscale/sfpowerscripts.core/lib/package/PackageDiffImpl";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import ArtifactGenerator from "@dxatscale/sfpowerscripts.core/lib/generators/ArtifactGenerator"

async function run() {
  try {
    let sfdx_package: string = tl.getInput("package", true);
    let version_number: string = tl.getInput("version_number", false);
    let tag: string = tl.getInput("tag", false);
    let config_file_path = tl.getInput("config_file_path", true);
    let installation_key_bypass = tl.getBoolInput("installationkeybypass", true);
    let isCoverageEnabled: boolean = tl.getBoolInput("enable_coverage", true);
    let isSkipValidation: boolean = tl.getBoolInput(
      "isValidationToBeSkipped",
      true
    );
    let isDiffCheckActive: boolean = tl.getBoolInput("isDiffCheck", false);
    let isGitTagActive: boolean = tl.getBoolInput("isGitTag", false);
    const setBuildNumber: boolean = tl.getBoolInput("set_build_number", true);

    let installation_key;

    if (!installation_key_bypass)
      installation_key = tl.getBoolInput("installationkey", true);

    let projectDirectory = tl.getInput("project_directory", false);
    let devhub_alias = tl.getInput("devhub_alias", true);
    let wait_time = tl.getInput("wait_time", true);

    let isRunBuild: boolean;
    if (isDiffCheckActive) {
      console.log("Heading to package Diff Impl");
      let packageDiffImpl = new PackageDiffImpl(
        sfdx_package,
        projectDirectory,
        config_file_path
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
      let packageMetadata: PackageMetadata = {
        package_name: sfdx_package,
        package_version_number: version_number,
        sourceVersion: tl.getVariable("build.sourceVersion"),
        repository_url: tl.getVariable("build.repository.uri"),
        tag: tag,
        branch:tl.getVariable("build.sourceBranch")
      };

      let createUnlockedPackageImpl: CreateUnlockedPackageImpl = new CreateUnlockedPackageImpl(
        sfdx_package,
        version_number,
        config_file_path,
        installation_key_bypass,
        installation_key,
        projectDirectory,
        devhub_alias,
        wait_time,
        isCoverageEnabled,
        isSkipValidation,
        packageMetadata
      );

       packageMetadata = await createUnlockedPackageImpl.exec();

      tl.setVariable(
        "sfpowerscripts_package_version_id",
        packageMetadata.package_version_id
      );
      tl.setVariable(
        "sfpowerscripts_package_version_number",
        packageMetadata.package_version_number
      );

      if (isGitTagActive) {
        let tagname = `${sfdx_package}_v${packageMetadata.package_version_number}`;
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

      if (setBuildNumber) {
        console.log(
          `Updating build number to ${packageMetadata.package_version_number}`
        );
        tl.updateBuildNumber(packageMetadata.package_version_number);
      }





      console.log("##[command]Package Metadata:"+JSON.stringify(packageMetadata,(key:string,value:any)=>{
        if(key=="payload")
          return undefined;
        else
          return value;
     }));


      let artifactFilepath: string = await ArtifactGenerator.generateArtifact(
        sfdx_package,projectDirectory,
        tl.getVariable("agent.tempDirectory"),
        packageMetadata
      );

      tl.uploadArtifact(`sfpowerscripts_artifacts`, artifactFilepath, `sfpowerscripts_artifacts`);
    }
  } catch (err) {
    console.log(err);
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();
