import path = require("path");
import fs from "fs-extra";
import SFPLogger from "../utils/SFPLogger";
const glob = require("glob");
import AdmZip = require("adm-zip");
import semver = require("semver");

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

    let artifacts: string[] = this.findArtifacts(artifactDirectory, sfdx_package);

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

    if (result.length > 0) {
      return result;
    } else {
      return null
    }
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
    let unzippedArtifactsDirectory: string = ".sfpowerscripts/unzippedArtifacts";

    fs.mkdirpSync(`.sfpowerscripts/unzippedArtifacts`);

    SFPLogger.log(`Unzipping ${artifact} to ${unzippedArtifactsDirectory}`);
    let zip = new AdmZip(artifact);

    // Overwrite existing files
    zip.extractAllTo(unzippedArtifactsDirectory, true);

    let artifactName: string = path.basename(artifact).match(/.*_sfpowerscripts_artifact/)[0]

    let packageMetadataFilePath = path.join(
      unzippedArtifactsDirectory,
      artifactName,
      "artifact_metadata.json"
    );

    let sourceDirectory = path.join(
      unzippedArtifactsDirectory,
      artifactName,
      `source`
    );

    let changelogFilePath = path.join(
      unzippedArtifactsDirectory,
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
   * Artifact format/s:
   * <sfdx_package>_sfpowerscripts_artifact
   * <sfdx_package>_sfpowerscripts_artifact_<version>.zip
   */
  private static findArtifacts(
    artifactDirectory: string,
    sfdx_package: string
  ): string[] {
    let pattern: string;
    if (sfdx_package) {
      pattern = `**/${sfdx_package}_sfpowerscripts_artifact*`;
    } else {
      pattern = `**/*_sfpowerscripts_artifact*`;
    }

    let artifacts: string[] = glob.sync(
      pattern,
      {
        cwd: artifactDirectory,
        absolute: true,
      }
    );

    if (sfdx_package && artifacts.length > 1) {
      SFPLogger.log(`Found more than one artifact for ${sfdx_package}`);
      let latestArtifact: string = ArtifactFilePathFetcher.getLatestArtifact(artifacts);
      SFPLogger.log(`Using latest artifact ${latestArtifact}`);
      return [latestArtifact];
    } else
      return artifacts;
  }

  /**
   * Get the artifact with the latest semantic version
   * @param artifacts
   */
  private static getLatestArtifact(artifacts: string[]) {
      // Consider zip artifacts only
      artifacts = artifacts.filter((artifact) => path.extname(artifact) === ".zip");

      let versions: string[] = artifacts.map( (artifact) => {
        let tokens = artifact.split("_");
        let version = tokens[tokens.length - 1];
        return version.slice(0, version.indexOf(".zip"));
      });

      // Pick artifact with latest semantic version
      let sortedVersions: string[] = semver.sort(versions);
      let latestVersion: string = sortedVersions.pop();

      return artifacts.find((artifact) => artifact.includes(latestVersion));
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
    artifacts: ArtifactFilePaths[],
    isToSkipOnMissingArtifact: boolean
  ): boolean {
    if (artifacts === null && !isToSkipOnMissingArtifact) {
      throw new Error(
        `Artifact not found, Please check the inputs`
      );
    } else if (
      artifacts === null && isToSkipOnMissingArtifact
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
