import { Org } from "@salesforce/core";
import { sfdx } from "./pool/sfdxnode/parallel";
import { SfdxApi } from "./pool/sfdxnode/types";
import { ScratchOrg } from "./pool/utils/ScratchOrgUtils";
import InstallPackageDepenciesImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallPackageDependenciesImpl";
import { PackageInstallationStatus } from "@dxatscale/sfpowerscripts.core/lib/package/PackageInstallationResult";
import child_process = require("child_process");
import * as fs from "fs-extra";
import ManifestHelpers from "@dxatscale/sfpowerscripts.core/src/manifest/ManifestHelpers";
import ArtifactFilePathFetcher from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";
import path = require("path");
import DeployImpl from "../deploy/DeployImpl";

const SFPOWERSCRIPTS_ARTIFACT_PACKAGE = "04t1P000000ka0fQAA";
export default class PrepareASingleOrgImpl {
  public constructor(
    private sfdx: SfdxApi,
    private scratchOrg: ScratchOrg,
    private hubOrg: Org,
    private fetchArtifactScript: string,
    private isAllPackagesToBeInstalled: boolean,
    private keys: string
  ) {}

  public async prepare(): Promise<ScriptExecutionResult> {
    //Install sfpowerscripts Artifact

    try {
      await sfdx.force.package.install({
        targetusername: this.scratchOrg.username,
        package: SFPOWERSCRIPTS_ARTIFACT_PACKAGE,
        apexcompile: "package",
        noprompt: true,
        wait: 60,
      });

      // Install Dependencies
      let installDependencies: InstallPackageDepenciesImpl = new InstallPackageDepenciesImpl(
        this.scratchOrg.username,
        this.hubOrg.getUsername(),
        60,
        null,
        this.keys,
        true
      );
      let installationResult = await installDependencies.exec();
      if (installationResult.result == PackageInstallationStatus.Failed) {
        throw new Error(installationResult.message);
      }

      //Create Artifact Directory
      fs.mkdirpSync("artifacts");

      //Fetch Latest Artifacts to Artifact Directory
      if (this.isAllPackagesToBeInstalled) {
        let packages = ManifestHelpers.getSFDXPackageManifest(null)[
          "packageDirectories"
        ];

        packages.forEach((pkg) => {
          this.fetchArtifactFromRepositoryUsingProvidedScript(
            pkg.package,
            "artifacts",
            this.fetchArtifactScript
          );
        });

        let deployImpl: DeployImpl = new DeployImpl(
          this.scratchOrg.username,
          "artifacts",
          "120",
          null,
          "pool",
          true,
          true
        );

        let deploymentResult = await deployImpl.exec();

        if (deploymentResult.failed.length > 0) {
          throw new Error(
            "Following Packages failed to deploy:" + deploymentResult.failed
          );
        }
      }

      return {
        status: "success",
        isSuccess: true,
        message: "Succesfully Created Scratch Org",
        scratchOrgUsername: this.scratchOrg.username,
      };
    } catch (error) {
      return {
        status: "failure",
        isSuccess: false,
        message: error.message,
        scratchOrgUsername: this.scratchOrg.username,
      };
    }
  }

  private fetchArtifactFromRepositoryUsingProvidedScript(
    packageName: string,
    artifactDirectory: string,
    scriptPath: string
  ) {
    console.log(`Fetching ${packageName} ...`);

    let cmd: string;
    if (process.platform !== "win32") {
      cmd = `bash -e ${scriptPath} ${packageName} ${artifactDirectory}`;
    } else {
      cmd = `cmd.exe /c ${scriptPath} ${packageName}  ${artifactDirectory}`;
    }

    child_process.execSync(cmd, {
      cwd: process.cwd(),
      stdio: ["ignore", "ignore", "inherit"],
    });
  }

  private getPackagesToDeploy(): any[] {
    let packagesToDeploy: any[];

    let packages = ManifestHelpers.getSFDXPackageManifest(null)[
      "packageDirectories"
    ];
    let artifacts = ArtifactFilePathFetcher.findArtifacts("artifacts");

    packagesToDeploy = packages.filter((pkg) => {
      let pattern = RegExp(`^${pkg.package}_sfpowerscripts_artifact.*`);
      return artifacts.find((artifact) =>
        pattern.test(path.basename(artifact))
      );
    });

    if (packagesToDeploy == null || packagesToDeploy.length === 0)
      throw new Error(`No artifacts from project config to be deployed`);
    else return packagesToDeploy;
  }
}

export interface ScriptExecutionResult {
  status: string;
  message: string;
  scratchOrgUsername: string;
  isSuccess: boolean;
}
