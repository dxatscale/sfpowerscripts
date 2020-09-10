import * as tl from "azure-pipelines-task-lib/task";
import path = require("path");
import fs = require("fs");
import { isNullOrUndefined } from "util";
const glob = require("glob");

export default class ArtifactFilePathFetcher {
  public constructor(
    private artifactAlias: string,
    private artiFactType: string,
    private sfdx_package?: string,
  ) {}


  public fetchArtifactFilePaths(): ArtifactFilePaths[] {
    let artifacts_filepaths: ArtifactFilePaths[];

    if (this.artiFactType === "Build")
      artifacts_filepaths = this.fetchArtifactFilePathFromBuildArtifact(
        this.artifactAlias,
        this.sfdx_package
      );
    // else if (this.artiFactType === "AzureArtifact")
    //   artiFactFilePaths = this.fetchArtifactFilePathFromAzureArtifact(
    //     this.sfdx_package,
    //     this.artifactAlias
    //   );
    // else if (this.artiFactType === "PipelineArtifact")
    //   artiFactFilePaths = this.fetchArtifactFilePathFromPipelineArtifacts(
    //     this.sfdx_package
    //   );

    return artifacts_filepaths;
  }

  private fetchArtifactFilePathFromBuildArtifact(
    artifactAlias: string,
    sfdx_package?: string,
  ): ArtifactFilePaths[] {
    const artifacts_filepaths: ArtifactFilePaths[] = [];

    let systemArtifactsDirectory = tl.getVariable("system.artifactsDirectory");

    // find sfpowerscripts artifacts using artifact alias

    let packageMetadataFilepaths: string[] = glob.sync(`artifact_metadata.json`, {
      cwd: path.join(systemArtifactsDirectory, artifactAlias),
      absolute: true
    });
    console.log(`globResult`, packageMetadataFilepaths);
    if (sfdx_package) {
      packageMetadataFilepaths = packageMetadataFilepaths.filter( (filepath) => {
        let artifactMetadata = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        return artifactMetadata["package_name"] === sfdx_package;
      });
    }

    for (let packageMetadataFilepath of packageMetadataFilepaths) {
      let sourceDirectory = path.join(
        path.dirname(packageMetadataFilepath),
        `source`
      );

      artifacts_filepaths.push({
        packageMetadataFilePath: packageMetadataFilepath,
        sourceDirectoryPath: sourceDirectory
      });
    }


    //Newest Artifact Format..v3
    // let packageMetadataFilePath;
    // let sourceDirectoryPath: string;

    // if (isNullOrUndefined(sfdx_package)) {
    //   packageMetadataFilePath = path.join(
    //     artifactDirectory,
    //     artifactAlias,
    //     `sfpowerscripts_artifact`,
    //     `artifact_metadata.json`
    //   );
    // } else {
    //   packageMetadataFilePath = path.join(
    //     artifactDirectory,
    //     artifactAlias,
    //     `${sfdx_package}_sfpowerscripts_artifact`,
    //     `artifact_metadata.json`
    //   );
    // }

    // //Check v3 Artifact Format Exists..
    // if (fs.existsSync(packageMetadataFilePath)) {
    //   console.log(`Artifact found at the location ${packageMetadataFilePath} `);

    //   if (isNullOrUndefined(sfdx_package)) {
    //     sourceDirectoryPath = path.join(
    //       artifactDirectory,
    //       artifactAlias,
    //       `sfpowerscripts_artifact`,
    //       `source`
    //     );
    //   } else {
    //     sourceDirectoryPath = path.join(
    //       artifactDirectory,
    //       artifactAlias,
    //       `${sfdx_package}_sfpowerscripts_artifact`,
    //       `source`
    //     );
    //   }
    // }

    // Filter with sfdx-package if given
    return artifacts_filepaths;
  }

  private fetchArtifactFilePathFromAzureArtifact(
    artifactAlias: string,
    sfdx_package?: string,
  ): ArtifactFilePaths {
    let artifactDirectory = tl.getVariable("system.artifactsDirectory");

    let metadataFilePath = path.join(
      artifactDirectory,
      artifactAlias,
      `artifact_metadata.json`
    );

    let sourceDirectoryPath: string = path.join(
      artifactDirectory,
      artifactAlias,
      `source`
    );
    return {
      packageMetadataFilePath: metadataFilePath,
      sourceDirectoryPath: sourceDirectoryPath,
    };
  }

  private fetchArtifactFilePathFromPipelineArtifacts(
    sfdx_package: string
  ): ArtifactFilePaths {
    let artifactDirectory = tl.getVariable("pipeline.workspace");

    if (isNullOrUndefined(this.sfdx_package)) {
      let metadataFilePath = path.join(
        artifactDirectory,
        `${sfdx_package}_sfpowerscripts_artifact`,
        `artifact_metadata.json`
      );

      let sourceDirectoryPath: string = path.join(
        artifactDirectory,
        `${sfdx_package}_sfpowerscripts_artifact`,
        `source`
      );
      return {
        packageMetadataFilePath: metadataFilePath,
        sourceDirectoryPath: sourceDirectoryPath,
      };
    } else {
      let metadataFilePath = path.join(
        artifactDirectory,
        `sfpowerscripts_artifact`,
        `artifact_metadata.json`
      );

      let sourceDirectoryPath: string = path.join(
        artifactDirectory,
        `sfpowerscripts_artifact`,
        `source`
      );
      return {
        packageMetadataFilePath: metadataFilePath,
        sourceDirectoryPath: sourceDirectoryPath,
      };
    }
  }

  public missingArtifactDecider(
    packageMetadataFilePath: string,
    isToSkipOnMissingArtifact: boolean
  ): void {
    if (!fs.existsSync(packageMetadataFilePath) && !isToSkipOnMissingArtifact) {
      throw new Error(
        `Artifact not found at ${packageMetadataFilePath}.. Please check the inputs`
      );
    } else if (
      !fs.existsSync(packageMetadataFilePath) &&
      isToSkipOnMissingArtifact
    ) {
      console.log(
        `Skipping task as artifact is missing, and 'Skip If no artifact is found' ${isToSkipOnMissingArtifact}`
      );
      tl.setResult(
        tl.TaskResult.Skipped,
        `Skipping task as artifact is missing, and 'Skip If no artifact is found' ${isToSkipOnMissingArtifact}`
      );
      process.exit(0);
    }
  }
}

export interface ArtifactFilePaths {
  packageMetadataFilePath: string;
  sourceDirectoryPath?: string;
}
