import { isNullOrUndefined } from "util";
import ManifestHelpers from "../manifest/ManifestHelpers";
import * as rimraf from "rimraf";
import SFPLogger from "../utils/SFPLogger";
import { mkdirpSync } from "fs-extra";
import * as fs from "fs-extra";
let path = require("path");




export default class SourcePackageGenerator {


  public static generateSourcePackageArtifact(
    projectDirectory: string,
    sfdx_package: string,
    packageDirectory:string,
    destructiveManifestFilePath?: string,
    configFilePath?:string
  ): string {

    let artifactDirectory=`.sfpowerscripts/${this.makefolderid(5)}_source`, rootDirectory;
    if (!isNullOrUndefined(projectDirectory)) {
      rootDirectory = projectDirectory;
    } else {
      rootDirectory = "";
    }

     if(isNullOrUndefined(packageDirectory))
       packageDirectory="";

    mkdirpSync(artifactDirectory);

    //Ensure the directory is clean
    rimraf.sync(path.join(artifactDirectory, packageDirectory))

    //Create a new directory
    fs.mkdirsSync(path.join(artifactDirectory, packageDirectory));
    fs.writeFileSync(
      path.join(artifactDirectory, "sfdx-project.json"),
      JSON.stringify(
        ManifestHelpers.cleanupMPDFromManifest(projectDirectory, sfdx_package)
      )
    );

    SourcePackageGenerator.createScripts(artifactDirectory, projectDirectory, sfdx_package);

    SourcePackageGenerator.createForceIgnores(artifactDirectory, projectDirectory, rootDirectory);


    if (!isNullOrUndefined(destructiveManifestFilePath)) {
      SourcePackageGenerator.copyDestructiveManifests(destructiveManifestFilePath, artifactDirectory, rootDirectory);
    }

    if(configFilePath)
    {
      SourcePackageGenerator.copyConfigFilePath(configFilePath, artifactDirectory, rootDirectory);
    }

    fs.copySync(
      path.join(rootDirectory,packageDirectory),
      path.join(artifactDirectory, packageDirectory)
    );

    return artifactDirectory;
  }

  /**
   * Create scripts directory containing preDeploy & postDeploy
   * @param artifactDirectory
   * @param projectDirectory
   * @param sfdx_package
   */
  private static createScripts(
    artifactDirectory: string,
    projectDirectory: string,
    sfdx_package
  ): void {
    let scriptsDir: string = path.join(artifactDirectory, `scripts`)
    mkdirpSync(scriptsDir);

    let packageDescriptor = ManifestHelpers.getSFDXPackageDescriptor(
      projectDirectory,
      sfdx_package
    );

    if (packageDescriptor.preDeploymentScript) {
      if (fs.existsSync(packageDescriptor.preDeploymentScript)) {
        fs.copySync(
          packageDescriptor.preDeploymentScript,
          path.join(scriptsDir, `preDeployment`)
        );
      } else {
        throw new Error(`preDeploymentScript ${packageDescriptor.preDeploymentScript} does not exist`);
      }
    }

    if (packageDescriptor.postDeploymentScript) {
      if (fs.existsSync(packageDescriptor.postDeploymentScript)) {
        fs.copySync(
          packageDescriptor.postDeploymentScript,
          path.join(scriptsDir, `postDeployment`)
        );
      } else {
        throw new Error(`postDeploymentScript ${packageDescriptor.postDeploymentScript} does not exist`);
      }
    }
  }

  /**
   * Create root forceignore and forceignores directory containing ignore files for different stages
   * @param artifactDirectory
   * @param projectDirectory
   * @param rootDirectory
   */
  private static createForceIgnores(
    artifactDirectory: string,
    projectDirectory: string,
    rootDirectory: string
  ): void {
    let forceIgnoresDir: string = path.join(artifactDirectory, `forceignores`);
    mkdirpSync(forceIgnoresDir);

    let projectConfig = ManifestHelpers.getSFDXPackageManifest(projectDirectory);
    let ignoreFiles = projectConfig.plugins?.sfpowerscripts?.ignoreFiles;

    let rootForceIgnore: string = path.join(rootDirectory, ".forceignore");
    let copyForceIgnoreForStage = (stage) => {
      if (ignoreFiles?.[stage])
        if (fs.existsSync(ignoreFiles[stage]))
          fs.copySync(
            ignoreFiles[stage],
            path.join(forceIgnoresDir, "." + stage + "ignore")
          );
        else
          throw new Error(`${ignoreFiles[stage]} does not exist`);
      else
        fs.copySync(
          rootForceIgnore,
          path.join(forceIgnoresDir, "." + stage + "ignore")
        );
    };

    let stages: string[] = ["prepare", "validate", "quickbuild", "build"];
    stages.forEach((stage) => copyForceIgnoreForStage(stage));


    fs.copySync(
      rootForceIgnore,
      path.join(artifactDirectory, ".forceignore")
    );
  }

  private static copyDestructiveManifests(destructiveManifestFilePath: string, artifactDirectory: string, projectDirectory: any) {
    if (fs.existsSync(destructiveManifestFilePath)) {
      try {
        fs.mkdirsSync(path.join(artifactDirectory, "destructive"));
        fs.copySync(
          path.join(projectDirectory, destructiveManifestFilePath),
          path.join(artifactDirectory, "destructive", "destructiveChanges.xml")
        );
      }
      catch (error) {
        SFPLogger.log("Unable to read/parse destructive manifest, Please check your artifacts, Will result in an error while deploying");
      }

    }
  }

  private static copyConfigFilePath(configFilePath: string, artifactDirectory: string, projectDirectory: any) {
    if (fs.existsSync(configFilePath)) {
      try {
        fs.mkdirsSync(path.join(artifactDirectory, "config"));
        fs.copySync(
          path.join(projectDirectory, configFilePath),
          path.join(artifactDirectory, "config", "project-scratch-def.json")
        );
      }
      catch (error) {
        SFPLogger.log("Unable to read/parse the config file path");
      }

    }
  }


  private static makefolderid(length): string {
    var result = "";
    var characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }


}
