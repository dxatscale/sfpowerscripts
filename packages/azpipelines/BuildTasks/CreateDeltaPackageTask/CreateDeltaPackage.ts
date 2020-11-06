import tl = require("azure-pipelines-task-lib/task");
import { isNullOrUndefined } from "util";
import CreateDeltaPackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/CreateDeltaPackageImpl";
import CreateSourcePackageImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/CreateSourcePackageImpl";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import ArtifactGenerator from "@dxatscale/sfpowerscripts.core/lib/generators/ArtifactGenerator";


async function run() {
  try {
    let sfdx_package = tl.getInput("package", false);
    const projectDirectory = tl.getInput("project_directory", false);
    const versionName: string = tl.getInput("version_name", false);
    const setBuildName: boolean = tl.getBoolInput("set_build_name", true);
    const revisionFrom: string = tl.getInput("revision_from", true);
    let revision_to: string = tl.getInput("revision_to", false);
    let options: any = {};
    options["bypass_directories"] = tl.getInput("bypass_directories", false);
    options["only_diff_for"] = tl.getInput("only_diff_for", false);
    if (isNullOrUndefined(revision_to)) {
      revision_to = tl.getVariable("build.sourceVersion");
    }
    const generate_destructivemanifest = tl.getBoolInput(
      "generate_destructivemanifest",
      false
    );
    if (setBuildName) {
      console.log(`Updating build number to ${versionName}`);
      tl.updateBuildNumber(versionName);
    }

    let repository_url = tl.getVariable("build.repository.uri");

    let packageMetadata: PackageMetadata = {
      package_name: sfdx_package,
      package_version_number: versionName,
      sourceVersionFrom: revisionFrom,
      sourceVersionTo: revision_to,
      repository_url: repository_url,
      branch:tl.getVariable("build.sourceBranch")
    };

    let createDeltaPackageImpl = new CreateDeltaPackageImpl(
      projectDirectory,
      sfdx_package,
      revisionFrom,
      revision_to,
      generate_destructivemanifest,
      options
    );
    let deltaPackage = await createDeltaPackageImpl.exec();

    console.log("DeltaPackage Details", deltaPackage);


     //Switch to delta and let source package know all tests has to be triggered
    packageMetadata.package_type = "delta";
    packageMetadata.isTriggerAllTests = true;
    
    let createSourcePackageImpl = new CreateSourcePackageImpl(
      deltaPackage.deltaDirectory,
      sfdx_package,
      deltaPackage.destructiveChanges
        ? deltaPackage.destructiveChangesPath
        : null,
      packageMetadata
    );
    packageMetadata = await createSourcePackageImpl.exec();




    console.log(
      "##[command]Package Metadata:" +
        JSON.stringify(packageMetadata, (key: string, value: any) => {
          if (key == "payload" || key == "destructiveChanges") return undefined;
          else return value;
        })
    );
    
   
   
    let artifact = await ArtifactGenerator.generateArtifact(
      sfdx_package,
      projectDirectory,
      tl.getVariable("agent.tempDirectory"),
      packageMetadata
    );
    if (!(sfdx_package===null || sfdx_package===undefined))
      tl.uploadArtifact(
        `${sfdx_package}_sfpowerscripts_artifact`,
        artifact.artifactDirectory,
        `${sfdx_package}_sfpowerscripts_artifact`
      );
    else
      tl.uploadArtifact(
        `sfpowerscripts_artifact`,
        artifact.artifactDirectory,
        `sfpowerscripts_artifact`
      );

    tl.setVariable(
      "sfpowerscripts_delta_package_path",
      deltaPackage.deltaDirectory
    );
  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();
