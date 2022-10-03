import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import * as fs from 'fs-extra';
import path = require('path');
import lodash = require('lodash');
import { URL } from 'url';
import SfpPackage from './SfpPackage';

/**
 * Methods for getting information about artifacts
 */
export default class SfpPackageInquirer {
    private _latestPackageManifestFromArtifacts: any;
    private _pathToLatestPackageManifestFromArtifacts: string;
    private _prunedLatestPackageManifestFromArtifacts: any;

    get pathToLatestPackageManifestFromArtifacts() {
        return this._pathToLatestPackageManifestFromArtifacts;
    }
    get prunedLatestPackageManifestFromArtifacts() {
        return this._prunedLatestPackageManifestFromArtifacts;
    }

    constructor(private readonly sfpPackages: SfpPackage[], private packageLogger?: Logger) {}

    public getLatestProjectConfig() {
        let latestPackageManifest = this.getLatestPackageManifestFromArtifacts(this.sfpPackages);

        if (latestPackageManifest) {
            this._latestPackageManifestFromArtifacts = latestPackageManifest.latestPackageManifest;
            this._pathToLatestPackageManifestFromArtifacts = latestPackageManifest.pathToLatestPackageManifest;

            this._prunedLatestPackageManifestFromArtifacts = this.pruneLatestPackageManifest(
                latestPackageManifest.latestPackageManifest,
                this.sfpPackages
            );
        }
        return this._latestPackageManifestFromArtifacts;
    }

    /**
     * Gets latest package manifest from artifacts
     * Returns null if unable to find latest package manifest
     */
    private getLatestPackageManifestFromArtifacts(
        sfpPackages: SfpPackage[]
    ): {
        latestPackageManifest: any;
        pathToLatestPackageManifest: string;
    } {
        let latestPackageManifest: any;
        let pathToLatestPackageManifest: string;

        this.validateArtifactsSourceRepository();

        let latestSfpPackage: SfpPackage;
        for (let sfpPackage of sfpPackages) {
            if (
                latestSfpPackage == null ||
                latestSfpPackage.creation_details.timestamp < sfpPackage.creation_details.timestamp
            ) {
                latestSfpPackage = sfpPackage;

                let pathToPackageManifest = path.join(sfpPackage.sourceDir, 'manifests', 'sfdx-project.json.ori');
                if (fs.existsSync(pathToPackageManifest)) {
                    latestPackageManifest = JSON.parse(fs.readFileSync(pathToPackageManifest, 'utf8'));

                    pathToLatestPackageManifest = pathToPackageManifest;
                }
            }
        }

        if (latestPackageManifest) {
            SFPLogger.log(
                `Found latest package manifest in ${latestSfpPackage.packageName} artifact`,
                LoggerLevel.INFO,
                this.packageLogger
            );

            return { latestPackageManifest, pathToLatestPackageManifest };
        } else return null;
    }

    /**
     * Verify that artifacts are from the same source repository
     */
    public validateArtifactsSourceRepository(): void {
        let remoteURL: RemoteURL;

        for (let sfpPackage of this.sfpPackages) {
            let currentRemoteURL: RemoteURL;

            let isHttp: boolean = sfpPackage.repository_url.match(/^https?:\/\//) ? true : false;
            if (isHttp) {
                const url = new URL(sfpPackage.repository_url);
                currentRemoteURL = {
                    ref: url.toString(),
                    hostName: url.hostname,
                    pathName: url.pathname,
                };
            } else {
                // Handle SSH URL separately, as it is not supported by URL module
                currentRemoteURL = {
                    ref: sfpPackage.repository_url,
                    hostName: null,
                    pathName: null,
                };
            }

            if (remoteURL == null) {
                remoteURL = currentRemoteURL;
                continue;
            }

            let isValid: boolean;
            if (isHttp) {
                if (
                    currentRemoteURL.hostName === remoteURL.hostName &&
                    currentRemoteURL.pathName === remoteURL.pathName
                )
                    isValid = true;
                else isValid = false;
            } else {
                if (currentRemoteURL.ref === remoteURL.ref) isValid = true;
                else isValid = false;
            }

            if (!isValid) {
                SFPLogger.log(`remoteURL: ${JSON.stringify(remoteURL)}`, LoggerLevel.DEBUG, this.packageLogger);
                SFPLogger.log(
                    `currentRemoteURL: ${JSON.stringify(currentRemoteURL)}`,
                    LoggerLevel.DEBUG,
                    this.packageLogger
                );
                throw new Error(
                    `Artifacts must originate from the same source repository, for deployment to work. The artifact ${sfpPackage.packageName} has repository URL that doesn't meet the current repository URL ${JSON.stringify(currentRemoteURL)} not equal ${JSON.stringify(remoteURL)}`
                );
            }
        }
    }

    /**
     * Remove packages that do not have an artifact from the package manifest
     * @param latestPackageManifest
     * @param artifacts
     */
    private pruneLatestPackageManifest(latestPackageManifest: any, sfpPackages: SfpPackage[]) {
        let prunedLatestPackageManifest = lodash.cloneDeep(latestPackageManifest);

        let packagesWithArtifacts: string[] = [];
        sfpPackages.forEach((sfpPackage) => {
            packagesWithArtifacts.push(sfpPackage.packageName);
        });

        let i = prunedLatestPackageManifest.packageDirectories.length;
        while (i--) {
            if (!packagesWithArtifacts.includes(prunedLatestPackageManifest.packageDirectories[i].package)) {
                let removedPackageDirectory = prunedLatestPackageManifest.packageDirectories.splice(i, 1);

                // Also remove references to the package as a dependency
                prunedLatestPackageManifest.packageDirectories.forEach((pkg) => {
                    let indexOfDependency = pkg.dependencies?.findIndex(
                        (dependency) => dependency.package === removedPackageDirectory[0].package
                    );

                    if (indexOfDependency >= 0) pkg.dependencies.splice(indexOfDependency, 1);
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
