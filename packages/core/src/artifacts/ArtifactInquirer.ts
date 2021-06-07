import { ArtifactFilePaths } from "./ArtifactFilePathFetcher";
import PackageMetadata from "../PackageMetadata";
import SFPLogger, { Logger, LoggerLevel } from "../logger/SFPLogger";
import * as fs from "fs-extra";
import path = require("path");
import lodash = require("lodash");


/**
 * Methods for getting information about artifacts
 */
export default class ArtifactInquirer {
  private _latestPackageManifestFromArtifacts: any
  private _pathToLatestPackageManifestFromArtifacts: string
  private _prunedLatestPackageManifestFromArtifacts: any

  get latestPackageManifestFromArtifacts() {
    return this._latestPackageManifestFromArtifacts;
  }
  get pathToLatestPackageManifestFromArtifacts() {
    return this._pathToLatestPackageManifestFromArtifacts;
  }
  get prunedLatestPackageManifestFromArtifacts() {
    return this._prunedLatestPackageManifestFromArtifacts;
  }

  constructor(
    private readonly artifacts: ArtifactFilePaths[],
    private packageLogger?: Logger
  ) {
    let latestPackageManifest = this.getLatestPackageManifestFromArtifacts(this.artifacts);

    if (latestPackageManifest) {
      this._latestPackageManifestFromArtifacts = latestPackageManifest.latestPackageManifest;
      this._pathToLatestPackageManifestFromArtifacts = latestPackageManifest.pathToLatestPackageManifest;

      this._prunedLatestPackageManifestFromArtifacts = this.pruneLatestPackageManifest(
        latestPackageManifest.latestPackageManifest,
        this.artifacts
      );
    }
  }

  /**
   * Gets latest package manifest from artifacts
   * Returns null if unable to find latest package manifest
   */
  private getLatestPackageManifestFromArtifacts(artifacts: ArtifactFilePaths[]): {
    latestPackageManifest: any,
    pathToLatestPackageManifest: string
  } {
    let latestPackageManifest: any;
    let pathToLatestPackageManifest: string;

    this.validateArtifactsSourceRepository();

    let latestPackageMetadata: PackageMetadata;
    for (let artifact of artifacts) {
      let packageMetadata: PackageMetadata = JSON.parse(
        fs.readFileSync(artifact.packageMetadataFilePath, "utf8")
      );

      if (
        latestPackageMetadata == null ||
        latestPackageMetadata.creation_details.timestamp <
          packageMetadata.creation_details.timestamp
      ) {
        latestPackageMetadata = packageMetadata;

        let pathToPackageManifest = path.join(
          artifact.sourceDirectoryPath,
          "manifests",
          "sfdx-project.json.ori"
        );
        if (fs.existsSync(pathToPackageManifest)) {
          latestPackageManifest = JSON.parse(
            fs.readFileSync(pathToPackageManifest, "utf8")
          );

          pathToLatestPackageManifest = pathToPackageManifest;
        }
      }
    }

    if (latestPackageManifest) {
      SFPLogger.log(
        `Found latest package manifest in ${latestPackageMetadata.package_name} artifact`,
        LoggerLevel.INFO,
        this.packageLogger,
      );

      return { latestPackageManifest, pathToLatestPackageManifest };
    } else return null;
  }

  /**
   * Verify that artifacts are from the same source repository
   */
  public validateArtifactsSourceRepository(): void {
    let sourceRepository: string;
    for (let artifact of this.artifacts) {
      let packageMetadata: PackageMetadata = JSON.parse(
        fs.readFileSync(artifact.packageMetadataFilePath, "utf8")
      );

      if (sourceRepository == null)
        sourceRepository = packageMetadata.repository_url;

      if (sourceRepository !== packageMetadata.repository_url)
        throw new Error(
          "Artifacts must originate from the same source repository, for deployment to work"
        );
    }
  }

  /**
   * Remove packages that do not have an artifact from the package manifest
   * @param latestPackageManifest
   * @param artifacts
   */
  private pruneLatestPackageManifest(
    latestPackageManifest: any,
    artifacts: ArtifactFilePaths[]
  ) {
    let prunedLatestPackageManifest = lodash.cloneDeep(latestPackageManifest);

    let packagesWithArtifacts: string[] = [];
    artifacts.forEach((artifact) => {
      let packageMetadata = JSON.parse(
        fs.readFileSync(artifact.packageMetadataFilePath, "utf8")
      );
      packagesWithArtifacts.push(packageMetadata.package_name);
    });

    let i = prunedLatestPackageManifest.packageDirectories.length;
    while(i--) {
      if (!packagesWithArtifacts.includes(prunedLatestPackageManifest.packageDirectories[i].package)) {
        let removedPackageDirectory = prunedLatestPackageManifest.packageDirectories.splice(i,1);

        // Also remove references to the package as a dependency
        prunedLatestPackageManifest.packageDirectories.forEach((pkg) => {
          let indexOfDependency = pkg.dependencies?.findIndex((dependency) =>
            dependency.package === removedPackageDirectory[0].package
          );

          if (indexOfDependency >= 0)
            pkg.dependencies.splice(indexOfDependency,1);
        });
      }
    }

    return prunedLatestPackageManifest;
  }
}
