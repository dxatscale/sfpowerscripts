import path = require('path');
import * as fs from 'fs-extra';
import GeneratePackageChangelog from '../../changelog/GeneratePackageChangelog';
import { Changelog } from '../../changelog/interfaces/GenericChangelogInterfaces';
import * as rimraf from 'rimraf';
import SFPLogger, { LoggerLevel } from '@dxatscale/sfp-logger';
import AdmZip = require('adm-zip');
import SfpPackage from '../../package/SfpPackage';

export default class ArtifactGenerator {
    //Generates the universal artifact used by the CLI and AZP
    public static async generateArtifact(
        sfpPackage: SfpPackage,
        project_directory: string,
        artifact_directory: string
    ): Promise<string> {
        try {
            // Artifact folder consisting of artifact metadata, changelog & source
            let artifactFolder: string = `${sfpPackage.packageName}_sfpowerscripts_artifact`;

            // Absolute filepath of artifact
            let artifactFilepath: string;

            if (artifact_directory != null) {
                artifactFilepath = path.resolve(artifact_directory, artifactFolder);
            } else {
                artifactFilepath = path.resolve(artifactFolder);
            }

            fs.mkdirpSync(artifactFilepath);

            let sourcePackage: string = path.join(artifactFilepath, `source`);
            fs.mkdirpSync(sourcePackage);

            //Clean up temp directory
            if (fs.existsSync(path.join(sfpPackage.workingDirectory, '.sfpowerscripts')))
                rimraf.sync(path.join(sfpPackage.workingDirectory, '.sfpowerscripts'));
            if (fs.existsSync(path.join(sfpPackage.workingDirectory, '.sfdx')))
                rimraf.sync(path.join(sfpPackage.workingDirectory, '.sfdx'));

            fs.copySync(sfpPackage.workingDirectory, sourcePackage);
            rimraf.sync(sfpPackage.workingDirectory);

            //Modify Source Directory to the new source directory inside the artifact
            sfpPackage.sourceDir = `source`;

            let artifactMetadataFilePath: string = path.join(artifactFilepath, `artifact_metadata.json`);

            fs.writeFileSync(artifactMetadataFilePath, JSON.stringify(sfpPackage, null, 4));

            // Generate package changelog
            // Doesnt need a from version number, as it always generate from start
            let generatePackageChangelog: GeneratePackageChangelog = new GeneratePackageChangelog(
                sfpPackage.packageName,
                undefined,
                sfpPackage.sourceVersion,
                project_directory
            );

            let packageChangelog: Changelog = await generatePackageChangelog.exec();

            let changelogFilepath: string = path.join(artifactFilepath, `changelog.json`);

            fs.writeFileSync(changelogFilepath, JSON.stringify(packageChangelog, null, 4));

            SFPLogger.log('Artifact Copy Completed', LoggerLevel.DEBUG);

            let zip = new AdmZip();
            zip.addLocalFolder(artifactFilepath, artifactFolder);
            SFPLogger.log(`Zipping ${artifactFolder}`, LoggerLevel.DEBUG);

            let packageVersionNumber: string = ArtifactGenerator.substituteBuildNumberWithPreRelease(
                sfpPackage.versionNumber
            );

            let zipArtifactFilepath: string = artifactFilepath + `_` + packageVersionNumber + `.zip`;
            zip.writeZip(zipArtifactFilepath);

            SFPLogger.log(
                `Artifact Generation Completed for ${sfpPackage.packageType} to ${zipArtifactFilepath}`,
                LoggerLevel.INFO
            );

            // Cleanup unzipped artifact
            rimraf.sync(artifactFilepath);

            return zipArtifactFilepath;
        } catch (error) {
            throw new Error('Unable to create artifact' + error);
        }
    }

    private static substituteBuildNumberWithPreRelease(packageVersionNumber: string) {
        let segments = packageVersionNumber.split('.');

        if (segments.length === 4) {
            packageVersionNumber = segments.reduce((version, segment, segmentsIdx) => {
                if (segmentsIdx === 3) return version + '-' + segment;
                else return version + '.' + segment;
            });
        }

        return packageVersionNumber;
    }
}
