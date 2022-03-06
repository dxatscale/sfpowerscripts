import path = require('path');
import * as fs from 'fs-extra';
import SFPLogger, { Logger, LoggerLevel } from '../logger/SFPLogger';
const glob = require('glob');
import AdmZip = require('adm-zip');
import semver = require('semver');
import tar = require('tar');

export default class ArtifactFilePathFetcher {
    /**
     * Decider for which artifact retrieval method to use
     * Returns empty array if no artifacts are found
     * @param artifactDirectory
     * @param sfdx_package
     */
    public static fetchArtifactFilePaths(
        artifactDirectory: string,
        sfdx_package?: string,
        logger?: Logger
    ): ArtifactFilePaths[] {
        let result: ArtifactFilePaths[] = [];

        if (!fs.existsSync(artifactDirectory)) {
            throw new Error(`Artifact directory ${path.resolve(artifactDirectory)} does not exist`);
        }

        let artifacts: string[] = this.findArtifacts(artifactDirectory, sfdx_package);

        if (artifacts.length === 0) {
            // For backwards compatibility, find artifact metadata
            artifacts = ArtifactFilePathFetcher.findArtifactMetadata(artifactDirectory, sfdx_package);
        }

        SFPLogger.log(`Artifacts: ${JSON.stringify(artifacts)}`, LoggerLevel.TRACE, logger);

        for (let artifact of artifacts) {
            let artifactFilePaths: ArtifactFilePaths;
            if (path.basename(artifact) === 'artifact_metadata.json') {
                artifactFilePaths = ArtifactFilePathFetcher.fetchArtifactFilePathsFromFolder(artifact);
            } else if (path.extname(artifact) === '.zip') {
                artifactFilePaths = ArtifactFilePathFetcher.fetchArtifactFilePathsFromZipFile(artifact);
            } else if (path.extname(artifact) === '.tgz') {
                artifactFilePaths = ArtifactFilePathFetcher.fetchArtifactFilePathsFromTarball(artifact);
            } else {
                throw new Error(`Unhandled artifact format ${artifact}, neither folder or zip file`);
            }
            result.push(artifactFilePaths);
        }

        return result;
    }

    /**
     * Helper method for retrieving the ArtifactFilePaths of an artifact folder
     * @param packageMetadataFilePath
     */
    private static fetchArtifactFilePathsFromFolder(packageMetadataFilePath: string): ArtifactFilePaths {
        let sourceDirectory = path.join(path.dirname(packageMetadataFilePath), `source`);

        let changelogFilePath = path.join(path.dirname(packageMetadataFilePath), `changelog.json`);

        let artifactFilePaths: ArtifactFilePaths = {
            packageMetadataFilePath: packageMetadataFilePath,
            sourceDirectoryPath: sourceDirectory,
            changelogFilePath: changelogFilePath,
        };

        ArtifactFilePathFetcher.existsArtifactFilepaths(artifactFilePaths);

        return artifactFilePaths;
    }

    /**
     * Helper method for retrieving ArtifactFilePaths of an artifact zip
     * @param artifact
     */
    private static fetchArtifactFilePathsFromZipFile(artifact: string): ArtifactFilePaths {
        let unzippedArtifactsDirectory: string = `.sfpowerscripts/unzippedArtifacts/${this.makefolderid(8)}`;

        fs.mkdirpSync(unzippedArtifactsDirectory);
        let zip = new AdmZip(artifact);

        // Overwrite existing files
        zip.extractAllTo(unzippedArtifactsDirectory, true);

        let artifactName: string = path.basename(artifact).match(/.*sfpowerscripts_artifact/)?.[0];
        if (artifactName == null) {
            throw new Error(`Failed to fetch artifact file paths for ${artifact}`);
        }

        let packageMetadataFilePath = path.join(unzippedArtifactsDirectory, artifactName, 'artifact_metadata.json');

        let sourceDirectory = path.join(unzippedArtifactsDirectory, artifactName, `source`);

        let changelogFilePath = path.join(unzippedArtifactsDirectory, artifactName, `changelog.json`);

        let artifactFilePaths: ArtifactFilePaths = {
            packageMetadataFilePath: packageMetadataFilePath,
            sourceDirectoryPath: sourceDirectory,
            changelogFilePath: changelogFilePath,
        };

        ArtifactFilePathFetcher.existsArtifactFilepaths(artifactFilePaths);

        return artifactFilePaths;
    }

    /**
     * Helper method for retrieving ArtifactFilePaths of a tarball
     * @param artifact
     */
    private static fetchArtifactFilePathsFromTarball(artifact: string): ArtifactFilePaths {
        let unzippedArtifactsDirectory: string = `.sfpowerscripts/unzippedArtifacts/${this.makefolderid(8)}`;
        fs.mkdirpSync(unzippedArtifactsDirectory);

        tar.x({
            file: artifact,
            cwd: unzippedArtifactsDirectory,
            sync: true,
        });

        let packageMetadataFilePath = path.join(unzippedArtifactsDirectory, 'package', 'artifact_metadata.json');

        let sourceDirectory = path.join(unzippedArtifactsDirectory, 'package', `source`);

        let changelogFilePath = path.join(unzippedArtifactsDirectory, 'package', `changelog.json`);

        let artifactFilePaths: ArtifactFilePaths = {
            packageMetadataFilePath: packageMetadataFilePath,
            sourceDirectoryPath: sourceDirectory,
            changelogFilePath: changelogFilePath,
        };

        ArtifactFilePathFetcher.existsArtifactFilepaths(artifactFilePaths);

        return artifactFilePaths;
    }

    /**
     * Find zip and tarball artifacts
     * Artifact format/s:
     * sfpowerscripts_artifact_<version>.zip,
     * [sfdx_package]_sfpowerscripts_artifact_[version].zip,
     * [sfdx_package]_sfpowerscripts_artifact_[version].tgz
     */
    public static findArtifacts(artifactDirectory: string, sfdx_package?: string): string[] {
        let pattern: string;
        if (sfdx_package) {
            pattern = `**/${sfdx_package}_sfpowerscripts_artifact*.@(zip|tgz)`;
        } else {
            pattern = `**/*sfpowerscripts_artifact*.@(zip|tgz)`;
        }

        let artifacts: string[] = glob.sync(pattern, {
            cwd: artifactDirectory,
            absolute: true,
        });

        if (sfdx_package && artifacts.length > 1) {
            SFPLogger.log(`Found more than one artifact for ${sfdx_package}`, LoggerLevel.INFO);
            let latestArtifact: string = ArtifactFilePathFetcher.getLatestArtifact(artifacts);
            SFPLogger.log(`Using latest artifact ${latestArtifact}`, LoggerLevel.INFO);
            return [latestArtifact];
        } else return artifacts;
    }

    /**
     * Get the artifact with the latest semantic version
     * @param artifacts
     */
    private static getLatestArtifact(artifacts: string[]) {
        // Consider zip & tarball artifacts only
        artifacts = artifacts.filter((artifact) => {
            let ext: string = path.extname(artifact);
            return ext === '.zip' || ext === '.tgz';
        });

        let pattern = new RegExp('(?:^.*)(?:_sfpowerscripts_artifact[_-])(?<version>.*)(?:\\.zip|\\.tgz)$');
        let versions: string[] = artifacts.map((artifact) => {
            let match: RegExpMatchArray = path.basename(artifact).match(pattern);
            let version = match?.groups.version;

            if (version) return version;
            else throw new Error('Corrupted artifact detected with no version number');
        });

        // Pick artifact with latest semantic version
        let sortedVersions: string[] = semver.sort(versions);
        let latestVersion: string = sortedVersions.pop();

        return artifacts.find((artifact) => artifact.includes(latestVersion));
    }

    /**
     * Find artifact metadata json
     * For backwards compatability with artifacts as a folder
     * @param artifactDirectory
     * @param sfdx_package
     */
    private static findArtifactMetadata(artifactDirectory: string, sfdx_package?: string): string[] {
        let packageMetadataFilepaths: string[] = glob.sync(`**/artifact_metadata.json`, {
            cwd: artifactDirectory,
            absolute: true,
        });

        if (sfdx_package) {
            // Filter and only return ArtifactFilePaths for sfdx_package
            packageMetadataFilepaths = packageMetadataFilepaths.filter((filepath) => {
                let artifactMetadata = JSON.parse(fs.readFileSync(filepath, 'utf8'));
                return artifactMetadata['package_name'] === sfdx_package;
            });
        }

        return packageMetadataFilepaths;
    }

    /**
     * Verify that artifact filepaths exist on the file system
     * @param artifactFilePaths
     */
    private static existsArtifactFilepaths(artifactFilePaths: ArtifactFilePaths): void {
        Object.values(artifactFilePaths).forEach((filepath) => {
            if (!fs.existsSync(filepath)) throw new Error(`Artifact filepath ${filepath} does not exist`);
        });
    }

    /**
     * Decider for task outcome if the artifact cannot be found
     * @param artifacts_filepaths
     * @param isToSkipOnMissingArtifact
     */
    public static missingArtifactDecider(artifacts: ArtifactFilePaths[], isToSkipOnMissingArtifact: boolean): boolean {
        if (artifacts.length === 0 && !isToSkipOnMissingArtifact) {
            throw new Error(`Artifact not found, Please check the inputs`);
        } else if (artifacts.length === 0 && isToSkipOnMissingArtifact) {
            SFPLogger.log(
                `Skipping task as artifact is missing, and 'Skip If no artifact is found' ${isToSkipOnMissingArtifact}`
            );
            return true;
        }
    }

    private static makefolderid(length): string {
        var result = '';
        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }
}

export interface ArtifactFilePaths {
    packageMetadataFilePath: string;
    sourceDirectoryPath?: string;
    changelogFilePath?: string;
}
