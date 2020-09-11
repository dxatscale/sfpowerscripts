import * as tl from "azure-pipelines-task-lib/task";
import path = require("path");
import fs = require("fs");
import { isNullOrUndefined } from "util";
const glob = require("glob");

export default class ArtifactFilePathFetcher {
  public constructor(
    private artifactAlias: string,
    private artifactType: string,
    private sfdx_package?: string,
  ) {}


  public fetchArtifactFilePaths(): ArtifactFilePaths[] {
    let artifacts_filepaths: ArtifactFilePaths[];

    if (this.artifactType === "Build")
      artifacts_filepaths = this.fetchArtifactFilePathFromBuildArtifact(
        this.artifactAlias,
        this.sfdx_package
      );
    else if (this.artifactType === "AzureArtifact")
      artifacts_filepaths = this.fetchArtifactFilePathFromBuildArtifact(
        this.sfdx_package,
        this.artifactAlias
      );
    // else if (this.artifactType === "PipelineArtifact")
    //   artiFactFilePaths = this.fetchArtifactFilePathFromPipelineArtifacts(
    //     this.sfdx_package
    //   );
    else {
      console.log(`Unsupported artifact type ${this.artifactType}`);
      console.log(`Defaulting to Build artifact...`);
      artifacts_filepaths = this.fetchArtifactFilePathFromBuildArtifact(
        this.artifactAlias,
        this.sfdx_package
      );
    }

    return artifacts_filepaths;
  }

  private fetchArtifactFilePathFromBuildArtifact(
    artifactAlias: string,
    sfdx_package?: string,
  ): ArtifactFilePaths[] {
    const artifacts_filepaths: ArtifactFilePaths[] = [];

    let systemArtifactsDirectory = tl.getVariable("system.artifactsDirectory");

    // find sfpowerscripts artifacts using artifact alias

    let packageMetadataFilepaths: string[] = glob.sync(`**/artifact_metadata.json`, {
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
