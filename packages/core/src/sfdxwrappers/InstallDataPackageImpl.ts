import PackageMetadata from "../PackageMetadata";
import AssignPermissionSetsImpl from "../sfdxwrappers/AssignPermissionSetsImpl";
import child_process = require("child_process");
import { onExit } from "../utils/OnExit";
import fs = require("fs");
import PackageInstallationStatusChecker from "../package/PackageInstallationStatusChecker";
import SFPLogger from "../utils/SFPLogger";
import { PackageInstallationResult, PackageInstallationStatus } from "../package/PackageInstallationResult";
import ManifestHelpers from "../manifest/ManifestHelpers";

const path = require("path");

export default class InstallDataPackageImpl {
  public constructor(
    private sfdx_package: string,
    private targetusername: string,
    private sourceDirectory: string,
    private subDirectory:string,
    private packageMetadata: PackageMetadata,
    private skip_if_package_installed: boolean,
    private isPackageCheckHandledByCaller?:boolean
  ) {}

  public async exec(): Promise<PackageInstallationResult> {
   
    let packageDirectory: string;

    try {
      let packageDescriptor = ManifestHelpers.getSFDXPackageDescriptor(this.sourceDirectory, this.sfdx_package);
      
      if (this.subDirectory) {
        packageDirectory = path.join(
          packageDescriptor["path"],
          this.subDirectory
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
        isPackageInstalled = await PackageInstallationStatusChecker.checkWhetherPackageIsIntalledInOrg(this.packageMetadata.package_name,this.packageMetadata,this.subDirectory, this.isPackageCheckHandledByCaller);
        if(isPackageInstalled)
          {
           SFPLogger.log("Skipping Package Installation")
           return { result: PackageInstallationStatus.Skipped }
          }
      }
  


      if (
        new RegExp("AssignPermissionSets", "i").test(this.packageMetadata.preDeploymentSteps?.toString()) &&
        this.packageMetadata.permissionSetsToAssign
      ) {
        let assignPermissionSetsImpl: AssignPermissionSetsImpl = new AssignPermissionSetsImpl(
          this.targetusername,
          this.packageMetadata.permissionSetsToAssign,
          this.sourceDirectory
        )

        console.log("Executing pre-deployment step: AssignPermissionSets");
        assignPermissionSetsImpl.exec();
      }

      let command = this.buildExecCommand(packageDirectory);
      let child = child_process.exec(
        command,
        { cwd: path.resolve(this.sourceDirectory), encoding: "utf8" }
      );

      child.stdout.on("data", (data) => {
        console.log(data.toString());
      });

      child.stderr.on("data", (data) => {
        console.log(data.toString());
      });

      await onExit(child);


      await PackageInstallationStatusChecker.updatePackageInstalledInOrg(this.targetusername,this.packageMetadata,this.isPackageCheckHandledByCaller);




    } catch (err) {
      throw err;
    } finally {
      let csvIssuesReportFilepath: string = path.join(this.sourceDirectory, packageDirectory, `CSVIssuesReport.csv`)
      if (fs.existsSync(csvIssuesReportFilepath)) {
        console.log(`\n---------------------WARNING: SFDMU detected CSV issues, verify the following files -------------------------------`);
        console.log(fs.readFileSync(csvIssuesReportFilepath, 'utf8'));
      }
    }
  }

  private buildExecCommand(packageDirectory:string): string {
    let command = `sfdx sfdmu:run --path ${packageDirectory} -s csvfile -u ${this.targetusername} --noprompt`;

    console.log(`Generated Command ${command}`);
    return command;
  }
}
