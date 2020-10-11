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
import Logger from "../utils/Logger";
import { EOL } from "os";

export default class BuildImpl {
  private limiter: Bottleneck;
  private packageBuildSchedulerWrappedForBottleNeck;
  private parentsToBeFulfilled;
  private childs;
  private packagesToBeBuilt: string[];
  private packageCreationPromises: Array<
    Promise<PackageCreationResult>
  > = new Array();
  private projectConfig: { any: any };
  private parents: any;
  private packagesInQueue: string[];
  private packagesBuilt: string[];

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
      maxConcurrent: 7,
      trackDoneStatus: true,
    });

    this.packageBuildSchedulerWrappedForBottleNeck = this.limiter.wrap(
      this.packageBuildScheduler
    );
    this.packagesBuilt = [];
  }

  public async exec(): Promise<PackageCreationResult[]> {
    console.log("-----------sfpowerscripts package builder------------------");
    let executionStartTime = Date.now();

    this.packagesToBeBuilt = ManifestHelpers.getAllPackages(
      this.project_directory
    );

    Logger.isSupressLogs = true;

    //console.log("Computing Packages to be deployed")
    // //Do a diff Impl
    // if(this.isDiffCheckEnabled)
    // {
    //   let packageToBeBuilt=[];
    //  for await (const pkg of this.packages) {
    //   let diffImpl:PackageDiffImpl = new PackageDiffImpl(pkg,this.project_directory, this.config_file_path);
    //   let isToBeBuilt=await diffImpl.exec();
    //   if(isToBeBuilt)
    //   {
    //     if(pkg!=='core-crm')
    //      packageToBeBuilt.push(pkg);
    //   }
    //  }
    //  this.packages=packageToBeBuilt;
    // }

    //List all package that will be built
    console.log("Packages scheduled to be built", this.packagesToBeBuilt);
    let countOfPackagesToBeBuilt = this.packagesToBeBuilt.length;

    this.childs = DependencyHelper.getChildsOfAllPackages(
      this.project_directory,
      this.packagesToBeBuilt
    );
    this.parents = DependencyHelper.getParentsOfAllPackages(
      this.project_directory,
      this.packagesToBeBuilt
    );

    this.parentsToBeFulfilled = DependencyHelper.getParentsToBeFullFilled(
      this.parents,
      this.packagesToBeBuilt
    );

    this.projectConfig = ManifestHelpers.getSFDXPackageManifest(
      this.project_directory
    );
    let sortedBatch = new BatchingTopoSort().sort(this.childs);

    let packageCreationResults: PackageCreationResult[];

    this.limiter.running().then((count) => {
      console.log("Current Packages being run:", count);
    });

    //Do First Level Package First
    let pushedPackages = [];
    for (const pkg of sortedBatch[0]) {
      let priority = 0;
      let type = ManifestHelpers.getPackageType(this.projectConfig, pkg);
      if (type == "Unlocked") {
        priority = 1;
      } else {
        priority = 5;
      }

      let promiseForFirstPackage: Promise<PackageCreationResult> = this.limiter.schedule(
        { id: pkg, priority: priority },
        () =>
          this.packageBuildScheduler(
            pkg,
            this.config_file_path,
            this.devhub_alias,
            this.wait_time,
            this.isSkipValidation,
            type
          )
      );
      pushedPackages.push(pkg);
      this.packageCreationPromises.push(promiseForFirstPackage);
    }

    //Remove Pushed Packages from the packages array
    this.packagesToBeBuilt = this.packagesToBeBuilt.filter((el) => {
      return !pushedPackages.includes(el);
    });

    this.packagesInQueue = Array.from(pushedPackages);

    console.log(
      `${EOL}Packages in queue:{${this.packagesInQueue.length}} `,
      `${this.packagesInQueue}`
    );
    console.log(
      `Awaiting Dependencies to be resolved:{${this.packagesToBeBuilt.length}} `,
      `${this.packagesToBeBuilt}`
    );

    //Other packages get added when each one in the first level finishes
    packageCreationResults = await Promise.all(this.packageCreationPromises);

    console.log(``);
    console.log(``);

    console.log(
      `----------------------------------------------------------------------------------------------------`
    );
    console.log(
      `${this.packagesBuilt.length} packages built in ${
        (Date.now() - executionStartTime) / 1000 / 60
      } minutes`
    );
    console.log(
      `----------------------------------------------------------------------------------------------------`
    );

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
      console.log(
        `${EOL}Package execution initiated for:`,
        `${sfdx_package}:${packageType}`
      );
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
          this.packagesBuilt.push(packageMetadata.package_name);
          console.log(
            `${EOL}-- ${packageMetadata.package_name} Package created in ${
              packageMetadata.creation_details.creation_time / 1000 / 60
            } minutes`
          );
          console.log(`-- Package Details:--`);
          console.log(
            `-- Package Version Number:        `,
            packageMetadata.package_version_number
          );
          if (packageMetadata.package_type == "unlocked") {
            console.log(
              `-- Package Version Id:             `,
              packageMetadata.package_version_id
            );
            console.log(
              `-- Package Test Coverage:          `,
              packageMetadata.test_coverage
            );
            console.log(
              `-- Package Coverage Check Passed:  `,
              packageMetadata.has_passed_coverage_check
            );
          } else if (packageMetadata.package_type == "source") {
            console.log(
              `-- Apex In Package:             `,
              packageMetadata.isApexFound
            );
            console.log(
              `-- Profiles In Package:         `,
              packageMetadata.isProfilesFound
            );
          }

          //let all my childs know, I am done building  and remove myself from
          this.packagesToBeBuilt.forEach((pkg) => {
            const unFullfilledParents = this.parentsToBeFulfilled[pkg].filter(
              (pkg_name) => pkg_name !== packageMetadata.package_name
            );
            this.parentsToBeFulfilled[pkg] = unFullfilledParents;
          });

          // Do a second pass and push packages with fulfilled parents to queue
          let pushedPackages = [];
          this.packagesToBeBuilt.forEach((pkg) => {
            if (this.parentsToBeFulfilled[pkg].length == 0) {

              let priority = 0;
              let type = ManifestHelpers.getPackageType(this.projectConfig, pkg);
              if (type == "Unlocked") {
                priority = 1;
              } else {
                priority = 5;
              }

              let packageCreationPromise: Promise<PackageCreationResult> = this.limiter.schedule(
                { id: pkg,priority:priority},
                () =>
                  this.packageBuildScheduler(
                    pkg,
                    this.config_file_path,
                    this.devhub_alias,
                    this.wait_time,
                    this.isSkipValidation,
                    type
                  )
              );
              pushedPackages.push(pkg);
              this.packagesInQueue.push(pkg);
              this.packageCreationPromises.push(packageCreationPromise);
            }
          });

          //Remove Pushed Packages from the packages array
          this.packagesToBeBuilt = this.packagesToBeBuilt.filter((el) => {
            return !pushedPackages.includes(el);
          });
          this.packagesInQueue = this.packagesInQueue.filter(
            (pkg_name) => pkg_name !== packageMetadata.package_name
          );

          console.log(
            `${EOL}Packages in queue:{${this.packagesInQueue.length}} `,
            `${this.packagesInQueue}`
          );
          console.log(
            `Awaiting Dependencies to be resolved:{${this.packagesToBeBuilt.length}} `,
            `${this.packagesToBeBuilt}`
          );

          resolve({
            status: "PackageCreated",
            message: `Package ${packageMetadata.package_name} Created  Sucessfully`,
            isSuccess: true,
            packageMetadata: packageMetadata,
          });
        },
        (reason: any) => {
          console.log(reason);
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
