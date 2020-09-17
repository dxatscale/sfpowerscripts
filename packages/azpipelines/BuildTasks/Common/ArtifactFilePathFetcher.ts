import * as tl from "azure-pipelines-task-lib/task";
import path = require("path");
import fs = require("fs");
import { isNullOrUndefined } from "util";
const glob = require("glob");

export default class ArtifactFilePathFetcher {

  /**
   * Decider for which artifact retrieval method to use
   *
   * @param artifactAlias
   * @param artifactType
   * @param sfdx_package
   */
  public static fetchArtifactFilePaths(
    artifactAlias: string,
    artifactType: string,
    sfdx_package?: string
  ): ArtifactFilePaths[] {
    let artifacts_filepaths: ArtifactFilePaths[];

    if (artifactType === "Build" ||
        artifactType === "PackageManagement" ||
        artifactType === "AzureArtifact" ||
        artifactType === "BuildArtifact"
    ) {
      artifacts_filepaths = ArtifactFilePathFetcher.fetchArtifactFilePathFromBuildArtifact(
        artifactAlias,
        sfdx_package
      );
    }
    else if (artifactType === "PipelineArtifact") {
      artifacts_filepaths = ArtifactFilePathFetcher.fetchArtifactFilePathFromPipelineArtifacts(
        sfdx_package
      );
    }
    else {
      console.log(`Unsupported artifact type ${artifactType}`);
      console.log(`Defaulting to Build artifact...`);

      artifacts_filepaths = ArtifactFilePathFetcher.fetchArtifactFilePathFromBuildArtifact(
        artifactAlias,
        sfdx_package
      );
    }

    return artifacts_filepaths;
  }

  /**
   * Helper method for retrieving the ArtifactFilePaths of packages
   * contained in an artifact alias directory
   *
   * @param artifactAlias
   * @param sfdx_package
   */
  private static fetchArtifactFilePathFromBuildArtifact(
    artifactAlias: string,
    sfdx_package: string
  ): ArtifactFilePaths[] {
    const artifacts_filepaths: ArtifactFilePaths[] = [];

    let systemArtifactsDirectory = tl.getVariable("system.artifactsDirectory");

    // Search artifact alias directory for files matching artifact_metadata.json
    let packageMetadataFilepaths: string[] = glob.sync(
      `**/artifact_metadata.json`,
      {
        cwd: path.join(systemArtifactsDirectory, artifactAlias),
        absolute: true,
      }
    );
    console.log(`globResult`, packageMetadataFilepaths);

    if (sfdx_package) {
      // Filter and only return ArtifactFilePaths for sfdx_package
      packageMetadataFilepaths = packageMetadataFilepaths.filter((filepath) => {
        let artifactMetadata = JSON.parse(fs.readFileSync(filepath, "utf8"));
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
        sourceDirectoryPath: sourceDirectory,
      });
    }

    return artifacts_filepaths;
  }

  /**
   * Helper method for retrieving the ArtifactFilePaths of a pipeline artifact
   * @param sfdx_package
   */
  private static fetchArtifactFilePathFromPipelineArtifacts(
    sfdx_package: string
  ): ArtifactFilePaths[] {
    const artifacts_filepaths: ArtifactFilePaths[] = [];

    let artifactDirectory = tl.getVariable("pipeline.workspace");

    // Search entire pipeline workspace for files matching artifact_metadata.json
    let packageMetadataFilepaths: string[] = glob.sync(
      `**/artifact_metadata.json`,
      {
        cwd: artifactDirectory,
        absolute: true
      }
    );

    console.log(`globResult`, packageMetadataFilepaths);

    if (sfdx_package) {
      // Filter and only return ArtifactFilePaths for sfdx_package
      packageMetadataFilepaths = packageMetadataFilepaths.filter((filepath) => {
        let artifactMetadata = JSON.parse(fs.readFileSync(filepath, "utf8"));
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
        sourceDirectoryPath: sourceDirectory,
      });
    }

    return artifacts_filepaths;
  }

  /**
   * Decider for task outcome if the artifact cannot be found
   * @param packageMetadataFilePath
   * @param isToSkipOnMissingArtifact
   */
  public static missingArtifactDecider(
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
