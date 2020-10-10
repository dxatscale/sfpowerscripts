import BatchingTopoSort from "../parallelBuilder/BatchingTopoSort";
import PackageMetadata from "../PackageMetadata";
import DependencyHelper from "../parallelBuilder/DependencyHelper";
import Bottleneck from "bottleneck";
import PackageDiffImpl from "../package/PackageDiffImpl";
import { execSync } from "child_process";
import CreateUnlockedPackageImpl from "./CreateUnlockedPackageImpl";
import ManifestHelpers from "../manifest/ManifestHelpers";
import CreateSourcePackageImpl from "./CreateSourcePackageImpl";
import IncrementProjectBuildNumberImpl from "./IncrementProjectBuildNumberImpl";
import PubSub from "pubsub-js";

export default class BuildImpl {
  private limiter;
  private packageBuildSchedulerWrappedForBottleNeck;
  private parentsToBeFulfilled;
  private childs;
  private packages: string[];
  private packageCreationPromises: Array<
    Promise<PackageCreationResult>
  > = new Array();
  private projectConfig: { any: any };
  parents: import("c:/Projects/sfpowerscripts/packages/core/src/parallelBuilder/DependencyHelper").AdjacentList;

  public constructor(
    private config_file_path: string,
    private project_directory: string,
    private devhub_alias: string,
    private repourl: string,
    private wait_time: string,
    private isSkipValidation: boolean,
    private isDiffCheckEnabled: boolean,
    private buildNumber: string
  ) {
    this.limiter = new Bottleneck({
      maxConcurrent: 1,
    });

    this.packageBuildSchedulerWrappedForBottleNeck = this.limiter.wrap(
      this.packageBuildScheduler
    );
  }

  public async exec(): Promise<PackageCreationResult[]> {

    this.packages = ManifestHelpers.getAllPackages(this.project_directory);

    console.log("Computing Packages to be deployed")
    //Do a diff Impl
    if(this.isDiffCheckEnabled)
    {
      let packageToBeBuilt=[];
     for await (const pkg of this.packages) {
      let diffImpl:PackageDiffImpl = new PackageDiffImpl(pkg,this.project_directory, this.config_file_path);
      let isToBeBuilt=await diffImpl.exec();
      if(isToBeBuilt)
      {
        packageToBeBuilt.push(pkg);
      }
     }
     this.packages=packageToBeBuilt;
    }

    //List all package that will be built
    console.log("Packages that are being built",this.packages);

    this.childs = DependencyHelper.getChildsOfAllPackages(
      this.project_directory,this.packages
    );
    this.parents = DependencyHelper.getParentsOfAllPackages(
      this.project_directory,this.packages
    );

    console.log("childs",this.childs);
    console.log("parents",this.parents);

    this.parentsToBeFulfilled = DependencyHelper.getParentsToBeFullFilled(this.parents,this.packages);

    console.log("parentsToBeFulfilled",this.parentsToBeFulfilled);

    process.exit(0);

    this.projectConfig = ManifestHelpers.getSFDXPackageManifest(
      this.project_directory
    );
    let sortedBatch = new BatchingTopoSort().sort(this.childs);
    console.log("Computed Build Order", sortedBatch);

    let packageCreationResults: PackageCreationResult[];

    //Do First Package First
    let promiseForFirstPackage: Promise<PackageCreationResult> = this.packageBuildSchedulerWrappedForBottleNeck(
      this.packages[0],
      this.config_file_path,
      this.devhub_alias,
      this.wait_time,
      this.isSkipValidation,
      ManifestHelpers.getPackageType(this.projectConfig, this.packages[0])
    );
    this.packageCreationPromises.push(promiseForFirstPackage);

    //Other packages get added when other packages finish
    packageCreationResults = await Promise.all(this.packageCreationPromises);

    return packageCreationResults;
  }

  private async packageBuildScheduler(
    sfdx_package: string,
    config_file_path: string,
    devhub_alias: string,
    wait_time: string,
    isSkipValidation: boolean,
    packageType: string
  ): Promise<PackageCreationResult> {
    return new Promise((resolve, reject) => {
      let packageCreationPromise = this.createPackage(
        packageType,
        sfdx_package,
        config_file_path,
        devhub_alias,
        wait_time,
        isSkipValidation
      );
      packageCreationPromise.then(
        (packageMetadata) => {
          //let all my childs know, I am done building  and remove myself from
          this.packages.forEach((pkg) => {
            const unFullfilledParents = this.parentsToBeFulfilled[pkg].filter(
              (pkg_name) => pkg_name !== packageMetadata.package_name
            );
            this.parentsToBeFulfilled[pkg] = unFullfilledParents;
          });

          // Do a second pass and push packages with fulfilled parents to queue
          this.packages.forEach((pkg) => {
            if (this.parentsToBeFulfilled[pkg].length == 0) {
              let packageCreationPromise: Promise<PackageCreationResult> = this.packageBuildSchedulerWrappedForBottleNeck(
                this.packages[0],
                this.config_file_path,
                this.devhub_alias,
                this.wait_time,
                this.isSkipValidation,
                this.isDiffCheckEnabled,
                ManifestHelpers.getPackageType(
                  this.projectConfig,
                  this.packages[0]
                )
              );
              this.packageCreationPromises.push(packageCreationPromise);
            }
          });
          resolve({
            status: "PackageCreated",
            message: `Package ${packageMetadata.package_name} Created  Sucessfully`,
            isSuccess: true,
            packageMetadata: packageMetadata,
          });
        },
        (reason: any) => {
          //let all my childs know that I failed, and there is no point continuing forward
        }
      );
    });
  }

  private createPackage(
    packageType: string,
    sfdx_package: string,
    config_file_path: string,
    devhub_alias: string,
    wait_time: string,
    isSkipValidation: boolean
  ): Promise<PackageMetadata> {
    let repository_url: string;
    if (this.repourl == null) {
      repository_url = execSync("git config --get remote.origin.url", {
        encoding: "utf8",
        cwd: this.project_directory,
      });
      // Remove new line '\n' from end of url
      repository_url = repository_url.slice(0, repository_url.length - 1);
    } else repository_url = this.repourl;

    let commit_id = execSync("git log --pretty=format:'%H' -n 1", {
      encoding: "utf8",
      cwd: this.project_directory,
    });

    let result;
    if (packageType == "Unlocked") {
      result = this.createUnlockedPackage(
        sfdx_package,
        commit_id,
        repository_url,
        config_file_path,
        devhub_alias,
        wait_time,
        isSkipValidation
      );
    } else {
      result = this.createSourcePackage(
        sfdx_package,
        commit_id,
        repository_url
      );
    }

    return result;
  }

  private createUnlockedPackage(
    sfdx_package: string,
    commit_id: string,
    repository_url: string,
    config_file_path: string,
    devhub_alias: string,
    wait_time: string,
    isSkipValidation: boolean
  ): Promise<PackageMetadata> {
    let packageMetadata: PackageMetadata = {
      package_name: sfdx_package,
      package_type: "unlocked",
      sourceVersion: commit_id,
      repository_url: repository_url,
    };

    let createUnlockedPackageImpl: CreateUnlockedPackageImpl = new CreateUnlockedPackageImpl(
      sfdx_package,
      null,
      config_file_path,
      true,
      null,
      null,
      devhub_alias,
      wait_time,
      !isSkipValidation,
      isSkipValidation,
      packageMetadata
    );

    let result = createUnlockedPackageImpl.exec();
    return result;
  }

  private createSourcePackage(
    sfdx_package: string,
    commit_id: string,
    repository_url: string
  ): Promise<PackageMetadata> {
    let incrementedVersionNumber;
    if (this.buildNumber) {
      let incrementBuildNumber = new IncrementProjectBuildNumberImpl(
        this.project_directory,
        sfdx_package,
        "BuildNumber",
        false,
        this.buildNumber
      );
      incrementedVersionNumber = incrementBuildNumber.exec();
    }

    let packageMetadata: PackageMetadata = {
      package_name: sfdx_package,
      sourceVersion: commit_id,
      package_version_number: incrementedVersionNumber?.versionNumber,
      repository_url: repository_url,
      package_type: "source",
      apextestsuite: null,
    };

    //Convert to MDAPI
    let createSourcePackageImpl = new CreateSourcePackageImpl(
      this.project_directory,
      sfdx_package,
      null,
      packageMetadata
    );
    let result = createSourcePackageImpl.exec();

    return result;
  }
}
type PackageCreationResult = {
  status: string;
  message: string;
  isSuccess: boolean;
  packageMetadata?: PackageMetadata;
};
