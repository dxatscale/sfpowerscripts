import SfpowerscriptsCommand from "./SfpowerscriptsCommand";
import { Messages } from "@salesforce/core";
import { flags } from "@salesforce/command";
import ArtifactFilePathFetcher, {ArtifactFilePaths} from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";
import * as rimraf from "rimraf";
import child_process = require("child_process");
import path = require("path");
import fs = require("fs");

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'install_package_command');

/**
 * Base class providing common functionality for package installation
 *
 * @extends SfpowerscriptsCommand
 */
export default abstract class InstallPackageCommand extends SfpowerscriptsCommand {

  /**
   * Flags that are common/required on all package installation commands
   */
  protected static flagsConfig = {
    package: flags.string({char: 'n', description: messages.getMessage('packageFlagDescription'), required: true}),
    targetorg: flags.string({char: 'u', description: messages.getMessage('targetOrgFlagDescription'), required: true}),
    artifactdir: flags.directory({description: messages.getMessage('artifactDirectoryFlagDescription'), default: 'artifacts'}),
    skiponmissingartifact: flags.boolean({char: 's', description: messages.getMessage('skipOnMissingArtifactFlagDescription')})
  };

  protected artifactFilePaths: ArtifactFilePaths;

  /**
   * Procedures unique to the type of package installation
   */
  abstract install(): Promise<any>;

  /**
   * Entry point for package installation commands
   *
   */
  async execute(): Promise<any> {
    this.preInstall();

    await this.install();

    this.postInstall();
  }

  /**
   * Procedures common to all install commands, and to be run BEFORE
   * the primary install
   */
  private preInstall(): void {
    let artifacts = ArtifactFilePathFetcher.fetchArtifactFilePaths(
      this.flags.artifactdir,
      this.flags.package
    );

    if (artifacts.length === 0) {
      if (!this.flags.skiponmissingartifact) {
        throw new Error(
          `${this.flags.package} artifact not found at ${this.flags.artifactdir}...Please check the inputs`
        );
      } else if (this.flags.skiponmissingartifact) {
        console.log(
          `Skipping task as artifact is missing, and 'SkipOnMissingArtifact' ${this.flags.skiponmissingartifact}`
        );
        process.exit(0);
      }
    } else this.artifactFilePaths = artifacts[0];


      let preDeploymentScript: string = path.join(
        this.artifactFilePaths.sourceDirectoryPath,
        `scripts`,
        `preDeployment`
      );

      if (fs.existsSync(preDeploymentScript)) {
        console.log("Executing preDeployment script");
        this.executeScript(preDeploymentScript);
      }
  }

  /**
   * Procedures common to all install commands, and to be run AFTER
   * the primary install
   */
  private postInstall(): void {
    let postDeploymentScript: string = path.join(
      this.artifactFilePaths.sourceDirectoryPath,
      `scripts`,
      `postDeployment`
    );

    if (fs.existsSync(postDeploymentScript)) {
      console.log("Executing postDeployment script");
      this.executeScript(postDeploymentScript);
    }

    // Delete temp directory containing unzipped artifacts
    rimraf.sync(".sfpowerscripts/unzippedArtifacts");
  }

  private executeScript(script: string) {
    let cmd: string;
    if (process.platform !== 'win32') {
      cmd = `bash -e ${script} ${this.flags.package} ${this.flags.targetorg}`;
    } else {
      cmd = `cmd.exe /c ${script} ${this.flags.package} ${this.flags.targetorg}`;
    }

    child_process.execSync(
      cmd,
      {
        cwd: process.cwd(),
        stdio: ['ignore', 'inherit', 'inherit']
      }
    );
  }

}
