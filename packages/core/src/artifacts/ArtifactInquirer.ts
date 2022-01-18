import { ArtifactFilePaths } from "./ArtifactFilePathFetcher";
import PackageMetadata from "../PackageMetadata";
import SFPLogger, { Logger, LoggerLevel } from "../logger/SFPLogger";
import * as fs from "fs-extra";
import path = require("path");
import lodash = require("lodash");
import { URL } from "url";

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
    let remoteURL: RemoteURL;

    for (let artifact of this.artifacts) {
      let currentRemoteURL: RemoteURL;

      let packageMetadata: PackageMetadata = JSON.parse(
        fs.readFileSync(artifact.packageMetadataFilePath, "utf8")
      );

      let isHttp: boolean = packageMetadata.repository_url.match(/^https?:\/\//) ? true : false
      if (isHttp) {
        const url = new URL(packageMetadata.repository_url);
        currentRemoteURL = {
          ref: url.toString(),
          hostName: url.hostname,
          pathName: url.pathname
        }
      } else {
        // Handle SSH URL separately, as it is not supported by URL module
        currentRemoteURL = {
          ref: packageMetadata.repository_url,
          hostName: null,
          pathName: null
        }
      }

      if (remoteURL == null) {
        remoteURL = currentRemoteURL;
        continue;
      }

      let isValid: boolean;
      if (isHttp) {
        if (currentRemoteURL.hostName === remoteURL.hostName && currentRemoteURL.pathName === remoteURL.pathName)
          isValid = true;
        else
          isValid = false;
      } else {
        if (currentRemoteURL.ref === remoteURL.ref ) isValid = true;
        else isValid = false;
      }

      if (!isValid) {
        SFPLogger.log(`remoteURL: ${JSON.stringify(remoteURL)}`, LoggerLevel.DEBUG, this.packageLogger);
        SFPLogger.log(`currentRemoteURL: ${JSON.stringify(currentRemoteURL)}`, LoggerLevel.DEBUG, this.packageLogger);
        throw new Error(
          `Artifacts must originate from the same source repository, for deployment to work. The artifact ${packageMetadata.package_name} has repository URL that doesn't meet the current repository URL ${currentRemoteURL}`
        );
      }
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

interface RemoteURL {
  ref: string;
  hostName: string;
  pathName: string;
}
