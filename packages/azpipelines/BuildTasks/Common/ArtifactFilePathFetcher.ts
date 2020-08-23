import * as tl from "azure-pipelines-task-lib/task";
import path = require("path");
import fs = require("fs");

export default class ArtifactFilePathFetcher {
  public constructor(
    private sfdx_package: string,
    private artifactAlias: string,
    private artiFactType: string
  ) {}

  public fetchArtifactFilePaths(): ArtifactFilePaths {
    let artiFactFilePaths: ArtifactFilePaths;

    if (this.artiFactType === "BuildArtifact")
      artiFactFilePaths = this.fetchArtifactFilePathFromBuildArtifact(
        this.sfdx_package,
        this.artifactAlias
      );
    else if (this.artiFactType === "AzureArtifact")
      artiFactFilePaths = this.fetchArtifactFilePathFromAzureArtifact(
        this.sfdx_package,
        this.artifactAlias
      );
    else if (this.artiFactType === "PipelineArtifact")
      artiFactFilePaths = this.fetchArtifactFilePathFromPipelineArtifacts(
        this.sfdx_package
      );

    return artiFactFilePaths;
  }

  private fetchArtifactFilePathFromBuildArtifact(
    sfdx_package: string,
    artifactAlias: string
  ): ArtifactFilePaths {
    let artifactDirectory = tl.getVariable("system.artifactsDirectory");

    //Newest Artifact Format..v3
    let packageMetadataFilePath = path.join(
      artifactDirectory,
      artifactAlias,
      `${sfdx_package}_sfpowerscripts_artifact`,
      `artifact_metadata.json`
    );

    //Check v3 Artifact Format Exists..
    if (fs.existsSync(packageMetadataFilePath)) {
      console.log(
        `Artifact format  found at the location ${packageMetadataFilePath} `
      );
      let sourceDirectoryPath: string = path.join(
        artifactDirectory,
        artifactAlias,
        `${sfdx_package}_sfpowerscripts_artifact`,
        `source`
      );
      return {
        packageMetadataFilePath: packageMetadataFilePath,
        sourceDirectoryPath: sourceDirectoryPath,
      };
    }

    //Check v1 metadata artifact
    packageMetadataFilePath = path.join(
      artifactDirectory,
      artifactAlias,
      "sfpowerkit_artifact",
      `${sfdx_package}_artifact_metadata`
    );

    if (!fs.existsSync(packageMetadataFilePath)) {
      console.log(
        `New Artifact format not found at the location ${packageMetadataFilePath} `
      );

      console.log("Falling back to older artifact format"); //v0 Historic
      packageMetadataFilePath = path.join(
        artifactDirectory,
        artifactAlias,
        "sfpowerkit_artifact",
        `artifact_metadata`
      );
    }

    return { packageMetadataFilePath: packageMetadataFilePath };
  }

  private fetchArtifactFilePathFromAzureArtifact(
    sfdx_package: string,
    artifactAlias: string
  ): ArtifactFilePaths {
    let artifactDirectory = tl.getVariable("system.artifactsDirectory");

    let metadataFilePath = path.join(
      artifactDirectory,
      artifactAlias,
      `${sfdx_package}_artifact_metadata`
    );

    let sourceDirectoryPath: string = path.join(
      artifactDirectory,
      artifactAlias,
      `${sfdx_package}_sfpowerscripts_source_package`
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
