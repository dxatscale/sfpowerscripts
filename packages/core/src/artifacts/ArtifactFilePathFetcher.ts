import path = require("path");
import fs = require("fs");
import SFPLogger from "../utils/SFPLogger";
const glob = require("glob");
import AdmZip = require('adm-zip');

export default class ArtifactFilePathFetcher {
  /**
   * Decider for which artifact retrieval method to use
   *
   * @param artifactDirectory
   * @param sfdx_package
   */
  public static fetchArtifactFilePaths(
    artifactDirectory: string,
    sfdx_package?: string
  ): ArtifactFilePaths[] {
    let result: ArtifactFilePaths[] = [];

    if (!fs.existsSync(artifactDirectory)) {
      throw new Error(`Artifact directory ${path.resolve(artifactDirectory)} does not exist`);
    }

    let artifacts: string[] = this.findArtifacts(artifactDirectory);

    if (sfdx_package) {
      // Artifact format: <sfdx_package>_sfpowerscripts_artifact OR <sfdx_package>_sfpowerscripts_artifact_<version>.zip
      let searchPattern: RegExp = new RegExp(`^${sfdx_package}_sfpowerscripts_artifact`);
      artifacts = artifacts.filter( (artifact) => {
        return searchPattern.test(path.basename(artifact));
      });

      // TODO: zip & folder are both present
      // TODO: more than one artifact (e.g. different versions)
      // TODO: No artifacts
    }

    SFPLogger.log("Artifacts", artifacts);

    for(let artifact of artifacts) {
      let fsStats = fs.lstatSync(artifact);
      let artifactFilePaths: ArtifactFilePaths
      if (fsStats.isDirectory()) {
        artifactFilePaths = ArtifactFilePathFetcher.fetchArtifactFilePathsFromFolder(
          artifact
        );
      } else if (
        fsStats.isFile() &&
        path.extname(artifact) === ".zip"
      ) {
        artifactFilePaths = ArtifactFilePathFetcher.fetchArtifactFilePathsFromZipFile(
          artifact
        );
      } else {
        throw new Error(`Unhandled artifact format ${artifact}, neither folder or zip file`);
      }
      result.push(artifactFilePaths);
    }

    SFPLogger.log("Artifact File Paths",JSON.stringify(result));

    // TODO: return null if length is zero
    return result;
  }

  /**
   * Helper method for retrieving the ArtifactFilePaths of a pipeline artifact
   * @param sfdx_package
   */
  private static fetchArtifactFilePathsFromFolder(
    artifact: string
  ): ArtifactFilePaths {

    let packageMetadataFilePath = path.join(
      artifact,
      "artifact_metadata.json"
    );

    let sourceDirectory = path.join(
      artifact,
      `source`
    );

    let changelogFilePath = path.join(
      artifact,
      `changelog.json`
    );

    let artifactFilePaths: ArtifactFilePaths = {
      packageMetadataFilePath: packageMetadataFilePath,
      sourceDirectoryPath: sourceDirectory,
      changelogFilePath: changelogFilePath
    };

    ArtifactFilePathFetcher.existsArtifactFilepaths(artifactFilePaths);

    return artifactFilePaths;
  }

  private static fetchArtifactFilePathsFromZipFile(
    artifact: string
  ): ArtifactFilePaths {
    SFPLogger.log(`Unzipping ${artifact}`);

    let zip = new AdmZip(artifact);

    let artifactDirectory: string = path.dirname(artifact);
    // Overwrite existing files
    zip.extractAllTo(artifactDirectory, true);
    // TODO see if extractall returns file paths

    let artifactName: string = path.basename(artifact).match(/.*_sfpowerscripts_artifact/)[0]

    let packageMetadataFilePath = path.join(
      artifactDirectory,
      artifactName,
      "artifact_metadata.json"
    );

    let sourceDirectory = path.join(
      artifactDirectory,
      artifactName,
      `source`
    );

    let changelogFilePath = path.join(
      artifactDirectory,
      artifactName,
      `changelog.json`
    );

    let artifactFilePaths: ArtifactFilePaths = {
      packageMetadataFilePath: packageMetadataFilePath,
      sourceDirectoryPath: sourceDirectory,
      changelogFilePath: changelogFilePath
    };

    ArtifactFilePathFetcher.existsArtifactFilepaths(artifactFilePaths);

    return artifactFilePaths;
  }

  /**
   * Find zip artifacts, and folder artifacts for backward compatibility
   */
  private static findArtifacts(
    artifactDirectory: string
  ): string[] {
    return glob.sync(
      `**/*_sfpowerscripts_artifact*`,
      {
        cwd: artifactDirectory,
        absolute: true,
      }
    );
  }

  /**
   * Verify that artifact filepaths exist on the file system
   * @param artifactFilePaths
   */
  private static existsArtifactFilepaths(artifactFilePaths: ArtifactFilePaths): void {
    Object.values(artifactFilePaths).forEach((filepath) => {
      if (!fs.existsSync(filepath))
        throw new Error(`Artifact filepath ${filepath} does not exist`);
    });
  }

  /**
   * Decider for task outcome if the artifact cannot be found
   * @param artifacts_filepaths
   * @param isToSkipOnMissingArtifact
   */
  public static missingArtifactDecider(
    artifacts_filepaths: ArtifactFilePaths[],
    isToSkipOnMissingArtifact: boolean
  ): boolean {
    if (artifacts_filepaths.length === 0 && !isToSkipOnMissingArtifact) {
      throw new Error(
        `Artifact not found, Please check the inputs`
      );
    } else if (
      artifacts_filepaths.length === 0 &&
      isToSkipOnMissingArtifact
    ) {
      SFPLogger.log(
        `Skipping task as artifact is missing, and 'Skip If no artifact is found' ${isToSkipOnMissingArtifact}`
      );
      return true;
    }
  }
}


export interface ArtifactFilePaths {
  packageMetadataFilePath: string;
  sourceDirectoryPath?: string;
  changelogFilePath?: string;
}
