import * as tl from "azure-pipelines-task-lib/task";
import path = require("path");
import fs = require("fs");
import { isNullOrUndefined } from "util";

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
    let packageMetadataFilePath;
    let sourceDirectoryPath: string;

    if (isNullOrUndefined(sfdx_package)) {
      packageMetadataFilePath = path.join(
        artifactDirectory,
        artifactAlias,
        `sfpowerscripts_artifact`,
        `artifact_metadata.json`
      );
    } else {
      packageMetadataFilePath = path.join(
        artifactDirectory,
        artifactAlias,
        `${sfdx_package}_sfpowerscripts_artifact`,
        `artifact_metadata.json`
      );
    }

    //Check v3 Artifact Format Exists..
    if (fs.existsSync(packageMetadataFilePath)) {
      console.log(`Artifact found at the location ${packageMetadataFilePath} `);

      if (isNullOrUndefined(sfdx_package)) {
        sourceDirectoryPath = path.join(
          artifactDirectory,
          artifactAlias,
          `sfpowerscripts_artifact`,
          `source`
        );
      } else {
        sourceDirectoryPath = path.join(
          artifactDirectory,
          artifactAlias,
          `${sfdx_package}_sfpowerscripts_artifact`,
          `source`
        );
      }
    }
    return {
      packageMetadataFilePath: packageMetadataFilePath,
      sourceDirectoryPath: sourceDirectoryPath,
    };
  }

  private fetchArtifactFilePathFromAzureArtifact(
    sfdx_package: string,
    artifactAlias: string
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

    if (!isNullOrUndefined(sfdx_package)) {
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
