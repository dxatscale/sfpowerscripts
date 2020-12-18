import PackageMetadata from "../PackageMetadata";
import AssignPermissionSetsImpl from "../sfdxwrappers/AssignPermissionSetsImpl";
import child_process = require("child_process");
import { onExit } from "../utils/OnExit";
import fs = require("fs");
import ArtifactInstallationStatusChecker from "../artifacts/ArtifactInstallationStatusChecker";
import { PackageInstallationResult, PackageInstallationStatus } from "../package/PackageInstallationResult";
import ManifestHelpers from "../manifest/ManifestHelpers";
import SFPLogger from "../utils/SFPLogger";
import PackageInstallationHelpers from "../utils/PackageInstallationHelpers";
const path = require("path");

export default class InstallDataPackageImpl {
  public constructor(
    private sfdx_package: string,
    private targetusername: string,
    private sourceDirectory: string,
    private packageMetadata: PackageMetadata,
    private skip_if_package_installed: boolean,
    private isPackageCheckHandledByCaller?:boolean,
    private packageLogger?:any
  ) {}

  public async exec(): Promise<PackageInstallationResult> {

    let packageDirectory: string;

    try {
      let packageDescriptor = ManifestHelpers.getSFDXPackageDescriptor(this.sourceDirectory, this.sfdx_package);

      if (packageDescriptor.aliasfy) {
        packageDirectory = path.join(
          packageDescriptor["path"],
          this.targetusername
        );
      } else {
        packageDirectory = path.join(
          packageDescriptor["path"]
        )
      }

      let absPackageDirectory: string = path.join(this.sourceDirectory, packageDirectory);
      if (!fs.existsSync(absPackageDirectory)) {
        throw new Error(`Source directory ${absPackageDirectory} does not exist`)
      }


      let isPackageInstalled = false;
      if (this.skip_if_package_installed) {
        isPackageInstalled = await ArtifactInstallationStatusChecker.checkWhetherPackageIsIntalledInOrg(
          this.targetusername,
          this.packageMetadata,
          packageDescriptor.aliasfy ? this.targetusername : null,
          this.isPackageCheckHandledByCaller
        );
        if(isPackageInstalled)
          {
           SFPLogger.log("Skipping Package Installation",null,this.packageLogger)
           return { result: PackageInstallationStatus.Skipped }
          }
      }

      let preDeploymentScript: string = path.join(
        this.sourceDirectory,
        `scripts`,
        `preDeployment`
      );

      if (fs.existsSync(preDeploymentScript)) {
        console.log("Executing preDeployment script");
        PackageInstallationHelpers.executeScript(
          preDeploymentScript,
          this.sfdx_package,
          this.targetusername
        );
      }

      SFPLogger.log("Assigning permission sets before deployment:",null,this.packageLogger);
      this.applyPermsets(this.packageMetadata.assignPermSetsPreDeployment);


      let command = this.buildExecCommand(packageDirectory);
      let child = child_process.exec(
        command,
        { cwd: path.resolve(this.sourceDirectory), encoding: "utf8" }
      );

      child.stdout.on("data", (data) => {
        SFPLogger.log(data.toString(),null,this.packageLogger);
      });

      child.stderr.on("data", (data) => {
        SFPLogger.log(data.toString(),null,this.packageLogger);
      });

      await onExit(child);

      let postDeploymentScript: string = path.join(
        this.sourceDirectory,
        `scripts`,
        `postDeployment`
      );

      if (fs.existsSync(postDeploymentScript)) {
        console.log("Executing postDeployment script");
        PackageInstallationHelpers.executeScript(
          postDeploymentScript,
          this.sfdx_package,
          this.targetusername
        );
      }

      SFPLogger.log("Assigning permission sets after deployment:",null,this.packageLogger);
      this.applyPermsets(this.packageMetadata.assignPermSetsPostDeployment);

      await ArtifactInstallationStatusChecker.updatePackageInstalledInOrg(
        this.targetusername,
        this.packageMetadata,
        packageDescriptor.aliasfy ? this.targetusername : null,
        this.isPackageCheckHandledByCaller
      );

      return {result: PackageInstallationStatus.Succeeded};


    } catch (err) {
      return {result: PackageInstallationStatus.Failed, message: err.message};
    } finally {
      let csvIssuesReportFilepath: string = path.join(this.sourceDirectory, packageDirectory, `CSVIssuesReport.csv`)
      if (fs.existsSync(csvIssuesReportFilepath)) {
        SFPLogger.log(`\n---------------------WARNING: SFDMU detected CSV issues, verify the following files -------------------------------`,null,this.packageLogger);
        SFPLogger.log(fs.readFileSync(csvIssuesReportFilepath, 'utf8'),null,this.packageLogger);
      }
    }
  }

  private buildExecCommand(packageDirectory:string): string {
    let command = `sfdx sfdmu:run --path ${packageDirectory} -s csvfile -u ${this.targetusername} --noprompt`;

    SFPLogger.log(`Generated Command ${command}`,null,this.packageLogger);
    return command;
  }

  private applyPermsets(permsets: string[]) {
    if (permsets) {
      let assignPermissionSetsImpl: AssignPermissionSetsImpl = new AssignPermissionSetsImpl(
        this.targetusername,
        permsets,
        this.sourceDirectory
      );

      assignPermissionSetsImpl.exec();
    }
  }
}
