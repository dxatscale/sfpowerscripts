import ProjectConfig from '../../project/ProjectConfig';
import * as rimraf from 'rimraf';
import SFPLogger, { Logger, LoggerLevel } from '../../logger/SFPLogger';
import { mkdirpSync } from 'fs-extra';
import * as fs from 'fs-extra';
import PackageComponentDiff from '../diff/PackageComponentDiff';
let path = require('path');

export default class SourcePackageGenerator {


    public static async generateSourcePackageArtifact(
        logger: Logger,
        projectDirectory: string,
        sfdx_package: string,
        packageDirectory: string,
        destructiveManifestFilePath?: string,
        configFilePath?: string,
        pathToReplacementForceIgnore?: string,
        revisionFrom?: string,
        revisionTo?: string
    ): Promise<string> {
        let artifactDirectory: string = `.sfpowerscripts/${this.makefolderid(5)}_source`,
            rootDirectory: string;

        if (projectDirectory) {
            rootDirectory = projectDirectory;
        } else {
            rootDirectory = '';
        }

        if (packageDirectory == null) packageDirectory = '';

        mkdirpSync(artifactDirectory);

        //Ensure the directory is clean
        rimraf.sync(path.join(artifactDirectory, packageDirectory));

        //Create a new directory
        fs.mkdirsSync(path.join(artifactDirectory, packageDirectory));

        SourcePackageGenerator.createScripts(artifactDirectory, rootDirectory, sfdx_package);

        SourcePackageGenerator.createForceIgnores(artifactDirectory, rootDirectory);

        //Compute diff
        //Skip errors.. diff is not important we can always fall back
        //Skip for aliasfied packages
        if (
            revisionFrom &&
            revisionTo &&
            !ProjectConfig.getSFDXPackageDescriptor(projectDirectory, sfdx_package).aliasfy
        ) {
            try {
                let packageComponentDiffer: PackageComponentDiff = new PackageComponentDiff(
                    logger,
                    sfdx_package,
                    revisionFrom,
                    revisionTo,
                    true
                );
                await packageComponentDiffer.build(path.join(artifactDirectory, 'diff'));
            } catch (error) {
                SFPLogger.log(`Unable to compute diff due to ${error}`, LoggerLevel.TRACE, logger);
            }
        }

        if (pathToReplacementForceIgnore)
            SourcePackageGenerator.replaceRootForceIgnore(artifactDirectory, pathToReplacementForceIgnore, logger);

        if (destructiveManifestFilePath) {
            SourcePackageGenerator.copyDestructiveManifests(
                destructiveManifestFilePath,
                artifactDirectory,
                rootDirectory,
                logger
            );
        }

        if (configFilePath) {
            SourcePackageGenerator.copyConfigFilePath(configFilePath, artifactDirectory, rootDirectory, logger);
        }

        SourcePackageGenerator.createPackageManifests(artifactDirectory, rootDirectory, sfdx_package);

        fs.copySync(path.join(rootDirectory, packageDirectory), path.join(artifactDirectory, packageDirectory));

        return artifactDirectory;
    }

    private static createPackageManifests(artifactDirectory: string, projectDirectory: string, sfdx_package: string) {
        // Create pruned package manifest in source directory
        let cleanedUpProjectManifest = ProjectConfig.cleanupMPDFromManifest(projectDirectory, sfdx_package);

        //Setup preDeployment Script Path
        if (fs.existsSync(path.join(artifactDirectory, 'scripts', `preDeployment`)))
            cleanedUpProjectManifest.packageDirectories[0].preDeploymentScript = path.join('scripts', `preDeployment`);

        //Setup postDeployment Script Path
         if (fs.existsSync(path.join(artifactDirectory, 'scripts', `postDeployment`)))
            cleanedUpProjectManifest.packageDirectories[0].postDeploymentScript = path.join(
                'scripts',
                `postDeployment`
            );

        fs.writeFileSync(path.join(artifactDirectory, 'sfdx-project.json'), JSON.stringify(cleanedUpProjectManifest));

        // Copy original package manifest
        let manifestsDir: string = path.join(artifactDirectory, `manifests`);
        mkdirpSync(manifestsDir);
        fs.copySync(path.join(projectDirectory, 'sfdx-project.json'), path.join(manifestsDir, 'sfdx-project.json.ori'));
    }

    /**
     * Create scripts directory containing preDeploy & postDeploy
     * @param artifactDirectory
     * @param projectDirectory
     * @param sfdx_package
     */
    private static createScripts(artifactDirectory: string, projectDirectory: string, sfdx_package): void {
        let scriptsDir: string = path.join(artifactDirectory, `scripts`);
        mkdirpSync(scriptsDir);

        let packageDescriptor = ProjectConfig.getSFDXPackageDescriptor(projectDirectory, sfdx_package);

        if (packageDescriptor.preDeploymentScript) {
            if (projectDirectory)
                packageDescriptor.preDeploymentScript = path.join(
                    projectDirectory,
                    packageDescriptor.preDeploymentScript
                );

            if (fs.existsSync(packageDescriptor.preDeploymentScript)) {
                fs.copySync(packageDescriptor.preDeploymentScript, path.join(scriptsDir, `preDeployment`));
            } else {
                throw new Error(`preDeploymentScript ${packageDescriptor.preDeploymentScript} does not exist`);
            }
        }


        if (packageDescriptor.postDeploymentScript) {
            if (projectDirectory)
                packageDescriptor.postDeploymentScript = path.join(
                    projectDirectory,
                    packageDescriptor.postDeploymentScript
                );

            if (fs.existsSync(packageDescriptor.postDeploymentScript)) {
                fs.copySync(packageDescriptor.postDeploymentScript, path.join(scriptsDir, `postDeployment`));
            } else {
                throw new Error(`postDeploymentScript ${packageDescriptor.postDeploymentScript} does not exist`);
            }
        }
    }

    /**
     * Create root forceignore and forceignores directory containing ignore files for different stages
     * @param artifactDirectory
     * @param projectDirectory
     */
    private static createForceIgnores(artifactDirectory: string, projectDirectory: string): void {
        let forceIgnoresDir: string = path.join(artifactDirectory, `forceignores`);
        mkdirpSync(forceIgnoresDir);

        let projectConfig = ProjectConfig.getSFDXPackageManifest(projectDirectory);
        let ignoreFiles = projectConfig.plugins?.sfpowerscripts?.ignoreFiles;

        //TODO: Make this readable
        //This is a fix when sfppackage is used in stages where build is not involved
        //So it has to be build from the root of the unzipped directory
        //and whatever mentioned in .json is already translated

        let rootForceIgnore: string = path.join(projectDirectory, '.forceignore');
        let copyForceIgnoreForStage = (stage) => {
            if (ignoreFiles?.[stage])
                if (fs.existsSync(path.join(projectDirectory, ignoreFiles[stage])))
                    fs.copySync(
                        path.join(projectDirectory, ignoreFiles[stage]),
                        path.join(forceIgnoresDir, '.' + stage + 'ignore')
                    );
                else if (fs.existsSync(path.join(projectDirectory, 'forceignores', '.' + stage + 'ignore')))
                    fs.copySync(
                        path.join(projectDirectory, 'forceignores', '.' + stage + 'ignore'),
                        path.join(forceIgnoresDir, '.' + stage + 'ignore')
                    );
                else throw new Error(`${ignoreFiles[stage]} does not exist`);
            else fs.copySync(rootForceIgnore, path.join(forceIgnoresDir, '.' + stage + 'ignore'));
        };

        let stages: string[] = ['prepare', 'validate', 'quickbuild', 'build'];
        stages.forEach((stage) => copyForceIgnoreForStage(stage));

        fs.copySync(rootForceIgnore, path.join(artifactDirectory, '.forceignore'));
    }

    /**
     * Replaces root forceignore with provided forceignore
     * @param artifactDirectory
     * @param pathToReplacementForceIgnore
     */
    private static replaceRootForceIgnore(
        artifactDirectory: string,
        pathToReplacementForceIgnore: string,
        logger: Logger
    ): void {
        if (fs.existsSync(pathToReplacementForceIgnore)) {
            fs.copySync(pathToReplacementForceIgnore, path.join(artifactDirectory, '.forceignore'));
        } else {
            SFPLogger.log(`${pathToReplacementForceIgnore} does not exist`, LoggerLevel.INFO, logger);
            SFPLogger.log(
                'Package creation will continue using the unchanged forceignore in the root directory',
                LoggerLevel.INFO,
                logger
            );
        }
    }

    private static copyDestructiveManifests(
        destructiveManifestFilePath: string,
        artifactDirectory: string,
        projectDirectory: any,
        logger: Logger
    ) {
        if (fs.existsSync(destructiveManifestFilePath)) {
            try {
                fs.mkdirsSync(path.join(artifactDirectory, 'destructive'));
                fs.copySync(
                    path.join(projectDirectory, destructiveManifestFilePath),
                    path.join(artifactDirectory, 'destructive', 'destructiveChanges.xml')
                );
            } catch (error) {
                SFPLogger.log(
                    'Unable to read/parse destructive manifest, Please check your artifacts, Will result in an error while deploying',
                    LoggerLevel.WARN,
                    logger
                );
            }
        }
    }

    private static copyConfigFilePath(
        configFilePath: string,
        artifactDirectory: string,
        projectDirectory: any,
        logger: Logger
    ) {
        if (fs.existsSync(configFilePath)) {
            try {
                fs.mkdirsSync(path.join(artifactDirectory, 'config'));
                fs.copySync(
                    path.join(projectDirectory, configFilePath),
                    path.join(artifactDirectory, 'config', 'project-scratch-def.json')
                );
            } catch (error) {
                SFPLogger.log(error, LoggerLevel.TRACE, logger);
                SFPLogger.log('Utilizing default config file path', LoggerLevel.TRACE, logger);
            }
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
