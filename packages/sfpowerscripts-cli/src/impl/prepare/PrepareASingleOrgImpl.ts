import { Org } from "@salesforce/core";
import { SfdxApi } from "./pool/sfdxnode/types";
import { ScratchOrg } from "./pool/utils/ScratchOrgUtils";
import InstallPackageDepenciesImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallPackageDependenciesImpl";
import { PackageInstallationStatus } from "@dxatscale/sfpowerscripts.core/lib/package/PackageInstallationResult";
import * as fs from "fs-extra";
import ManifestHelpers from "@dxatscale/sfpowerscripts.core/src/manifest/ManifestHelpers";
import ArtifactFilePathFetcher from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";
import path = require("path");
import DeployImpl from "../deploy/DeployImpl";
import { EOL } from "os";
import SFPLogger from "@dxatscale/sfpowerscripts.core/src/utils/SFPLogger";

const SFPOWERSCRIPTS_ARTIFACT_PACKAGE = "04t1P000000ka0fQAA";
export default class PrepareASingleOrgImpl {
  public constructor(
    private sfdx: SfdxApi,
    private scratchOrg: ScratchOrg,
    private hubOrg: Org,
    private isAllPackagesToBeInstalled: boolean,
    private keys: string
  ) {}

  public async prepare(): Promise<ScriptExecutionResult> {
    //Install sfpowerscripts Artifact

    try {


       //Create file logger
       fs.outputFileSync(
        `.sfpowerscripts/prepare_logs/${this.scratchOrg.alias}.log`,
        `sfpowerscripts--log${EOL}`
      );
      SFPLogger.isSupressLogs=true;
      let packageLogger:any = `.sfpowerscripts/prepare_logs/${this.scratchOrg.alias}`;
      SFPLogger.log(`Installing sfpowerscripts_artifact package to the ${this.scratchOrg.alias}`,null,packageLogger);

      await this.sfdx.force.package.install({
        quiet:true,
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
        true,
        packageLogger
      );
      let installationResult = await installDependencies.exec();
      if (installationResult.result == PackageInstallationStatus.Failed) {
        throw new Error(installationResult.message);
      }

      if (this.isAllPackagesToBeInstalled) {

       
        //Deploy the fetched artifacts to the org
        let deployImpl: DeployImpl = new DeployImpl(
          this.scratchOrg.username,
          "artifacts",
          "120",
          null,
          "pool",
          true,
          true,
          packageLogger
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
}

export interface ScriptExecutionResult {
  status: string;
  message: string;
  scratchOrgUsername: string;
  isSuccess: boolean;
}
