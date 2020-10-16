import BatchingTopoSort from "./BatchingTopoSort";
import PackageMetadata from "../PackageMetadata";
import DependencyHelper from "./DependencyHelper";
import Bottleneck from "bottleneck";
import PackageDiffImpl from "../package/PackageDiffImpl";
import { exec } from "shelljs";
import CreateUnlockedPackageImpl from "../sfdxwrappers/CreateUnlockedPackageImpl";
import ManifestHelpers from "../manifest/ManifestHelpers";
import CreateSourcePackageImpl from "../sfdxwrappers/CreateSourcePackageImpl";
import CreateDataPackageImpl from "../sfdxwrappers/CreateDataPackageImpl";
import IncrementProjectBuildNumberImpl from "../sfdxwrappers/IncrementProjectBuildNumberImpl";
import SFPLogger from "../utils/SFPLogger";
import { EOL } from "os";
import * as rimraf from "rimraf";
import SourcePackageGenerator from "../generators/SourcePackageGenerator";
import PackageVersionListImpl from "../sfdxwrappers/PackageVersionListImpl";
const fs = require("fs-extra");
let path = require("path");

const PRIORITY_UNLOCKED_PKG_WITH_DEPENDENCY = 1;
const PRIORITY_UNLOCKED_PKG_WITHOUT_DEPENDENCY = 3;
const PRIORITY_SOURCE_PKG = 5;
const PRIORITY_DATA_PKG = 5;
export default class BuildImpl {

  private limiter: Bottleneck;
  private parentsToBeFulfilled;
  private childs;
  private packagesToBeBuilt: string[];
  private packageCreationPromises: Array<Promise<PackageMetadata>>;
  private projectConfig: { any: any };
  private parents: any;
  private packagesInQueue: string[];
  private packagesBuilt: string[];
  private failedPackages: string[];
  private generatedPackages: PackageMetadata[];
  private orgDependentPackages:string[];
  private packageInfo:any[];

  private recursiveAll = (a) =>
    Promise.all(a).then((r) =>
      r.length == a.length ? r : this.recursiveAll(a)
    );
 private  unlockedPackages: any[];

  public constructor(
    private config_file_path: string,
    private project_directory: string,
    private devhub_alias: string,
    private repourl: string,
    private wait_time: string,
    private isSkipValidation: boolean,
    private isDiffCheckEnabled: boolean,
    private buildNumber: number,
    private executorcount:number
  ) {
    this.limiter = new Bottleneck({
      maxConcurrent: this.executorcount
    });

    this.packagesBuilt = [];
    this.failedPackages = [];
    this.generatedPackages = [];
    this.packageCreationPromises = new Array();
    this.orgDependentPackages=[];
  }

  public async exec(): Promise<{generatedPackages:PackageMetadata[],failedPackages:string[]}> {
    console.log("-----------sfpowerscripts package builder------------------");
    let executionStartTime = Date.now();

    this.packagesToBeBuilt = ManifestHelpers.getAllPackages(
      this.project_directory
    );



    rimraf.sync(".sfpowerscripts");

    

    console.log("Computing Packages to be deployed");
    SFPLogger.isSupressLogs = true;

    //Do a diff Impl
    if (this.isDiffCheckEnabled) {
      let packageToBeBuilt = [];
      for await (const pkg of this.packagesToBeBuilt) {
        let diffImpl: PackageDiffImpl = new PackageDiffImpl(
          pkg,
          this.project_directory,
          this.config_file_path
        );
        let isToBeBuilt = await diffImpl.exec();
        if (isToBeBuilt) {
           packageToBeBuilt.push(pkg);
        }
      }
      this.packagesToBeBuilt = packageToBeBuilt;
    }
  
    //List all package that will be built
    console.log("Packages scheduled to be built", this.packagesToBeBuilt);

    console.log("Fetching Unlocked Package Info..");
    this.orgDependentPackages = await this.getOrgDependentPackages();
    this.unlockedPackages = await this.getUnlockedPacakges();



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
    let sortedBatch  = new BatchingTopoSort().sort(this.childs);
    
    //Do First Level Package First
    let pushedPackages = [];
    for (const pkg of sortedBatch[0]) {
      let { priority, type } = this.getPriorityandTypeOfAPackage(pkg);
      let packagePromise: Promise<PackageMetadata> = this.limiter
        .schedule({ id: pkg, priority: priority }, () =>
          this.createPackage(
            type,
            pkg,
            this.config_file_path,
            this.devhub_alias,
            this.wait_time,
            this.isSkipValidation
          )
        )
        .then(
          (packageMetadata: PackageMetadata) => {
            this.generatedPackages.push(packageMetadata);
            this.queueChildPackages(packageMetadata);
          },
          (reason: any) => this.handlePackageError(reason, pkg)
        );

      pushedPackages.push(pkg);
      this.packageCreationPromises.push(packagePromise);
    }

    //Remove Pushed Packages from the packages array
    this.packagesToBeBuilt = this.packagesToBeBuilt.filter((el) => {
      return !pushedPackages.includes(el);
    });

    this.packagesInQueue = Array.from(pushedPackages);

    this.printQueueDetails();

    //Other packages get added when each one in the first level finishes
    await this.recursiveAll(this.packageCreationPromises);

    console.log(``);
    console.log(``);

    console.log(
      `----------------------------------------------------------------------------------------------------`
    );
    console.log(
      `${this.packagesBuilt.length} packages created in ${this.getFormattedTime(
        Date.now() - executionStartTime
      )} minutes with {${this.failedPackages.length}} errors`
    );
    if (this.failedPackages.length > 0) {
      console.log(`Failed To Build`, this.failedPackages);
    }
    console.log(
      `----------------------------------------------------------------------------------------------------`
    );


    return {generatedPackages:this.generatedPackages,failedPackages:this.failedPackages};
  }

  private printQueueDetails() {
    console.log(
      `${EOL}Packages currently processed:{${this.packagesInQueue.length}} `,
      `${this.packagesInQueue}`
    );
    console.log(
      `Awaiting Dependencies to be resolved:{${this.packagesToBeBuilt.length}} `,
      `${this.packagesToBeBuilt}`
    );
  }

  private getFormattedTime(milliseconds: number): string {
    let date = new Date(0);
    date.setSeconds(milliseconds / 1000); // specify value for SECONDS here
    let timeString = date.toISOString().substr(11, 8);
    return timeString;
  }

  private handlePackageError(reason: any, pkg: string): any {
    console.log(`${EOL}-----------------------------------------`);
    console.log(`Package Creation Failed for ${pkg}`);
    try {
      let data = fs.readFileSync(`.sfpowerscripts/logs/${pkg}`, "utf8");
      console.log(data);
    } catch (e) {
      console.log(`Unable to display logs for pkg ${pkg}`);
    }
    console.log(`${EOL}Removed all childs of ${pkg} from queue`);
    console.log(`${EOL}-----------------------------------------`);

    //Remove the package from packages To Be Built
    this.packagesToBeBuilt = this.packagesToBeBuilt.filter((el) => {
      if (el == pkg) return false;
      else return true;
    });
    this.packagesInQueue = this.packagesInQueue.filter((pkg_name) => {
      if (pkg == pkg_name) return false;
      else return true;
    });

    //Remove my childs
    this.packagesToBeBuilt = this.packagesToBeBuilt.filter((pkg) => {
      if (this.childs[pkg].includes(pkg)) {
        return false;
      }
    });

    this.failedPackages.push(pkg);
  }

  private queueChildPackages(packageMetadata: PackageMetadata): any {
    this.packagesBuilt.push(packageMetadata.package_name);
    this.printPackageDetails(packageMetadata);

    //let all my childs know, I am done building  and remove myself from
    this.packagesToBeBuilt.forEach((pkg) => {
      const unFullfilledParents = this.parentsToBeFulfilled[pkg]?.filter(
        (pkg_name) => pkg_name !== packageMetadata.package_name
      );
      this.parentsToBeFulfilled[pkg] = unFullfilledParents;
    });

    // Do a second pass and push packages with fulfilled parents to queue
    let pushedPackages = [];
    this.packagesToBeBuilt.forEach((pkg) => {
      if (this.parentsToBeFulfilled[pkg]?.length == 0) {
        let { priority, type } = this.getPriorityandTypeOfAPackage(pkg);
        let packagePromise: Promise<PackageMetadata> = this.limiter
          .schedule({ id: pkg, priority: priority }, () =>
            this.createPackage(
              type,
              pkg,
              this.config_file_path,
              this.devhub_alias,
              this.wait_time,
              this.isSkipValidation
            )
          )
          .then(
            (packageMetadata: PackageMetadata) => {
              this.generatedPackages.push(packageMetadata);
              this.queueChildPackages(packageMetadata);
            },
            (reason: any) => this.handlePackageError(reason, pkg)
          );
        pushedPackages.push(pkg);
        this.packagesInQueue.push(pkg);
        this.packageCreationPromises.push(packagePromise);
      }
    });

    if (pushedPackages.length > 0) {
      console.log(
        `${EOL}Packages being pushed to the queue:{${pushedPackages.length}} `,
        `${pushedPackages}`
      );
    }
    //Remove Pushed Packages from the packages array
    this.packagesToBeBuilt = this.packagesToBeBuilt.filter((el) => {
      return !pushedPackages.includes(el);
    });
    this.packagesInQueue = this.packagesInQueue.filter(
      (pkg_name) => pkg_name !== packageMetadata.package_name
    );

    this.printQueueDetails();
  }

  private getPriorityandTypeOfAPackage(pkg: string) {
    let priority = 0;
    let type = ManifestHelpers.getPackageType(this.projectConfig, pkg);
    if (type === "Unlocked") {
      if (this.childs[pkg] > 0)
        priority = PRIORITY_UNLOCKED_PKG_WITH_DEPENDENCY;
      else priority = PRIORITY_UNLOCKED_PKG_WITHOUT_DEPENDENCY;
    } else if (type === "Source") {
      priority = PRIORITY_SOURCE_PKG;
    } else if (type === "Data") {
      priority = PRIORITY_DATA_PKG;
    } else {
      throw new Error(`Unknown package type ${type}`);
    }

    return { priority, type };
  }

  private printPackageDetails(packageMetadata: PackageMetadata) {
    console.log(
      `${EOL}${
        packageMetadata.package_name
      } package created in ${this.getFormattedTime(
        packageMetadata.creation_details.creation_time
      )}`
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
      repository_url = exec("git config --get remote.origin.url", {
        silent: true,
      });
      // Remove new line '\n' from end of url
      repository_url = repository_url.slice(0, repository_url.length - 1);
    } else repository_url = this.repourl;

    let commit_id = exec("git log --pretty=format:%H -n 1", {
      silent: true,
    });

    console.log(`Package creation initiated for  ${sfdx_package}`);

    let result;
    if (packageType === "Unlocked") {
      result = this.createUnlockedPackage(
        sfdx_package,
        commit_id,
        repository_url,
        config_file_path,
        devhub_alias,
        wait_time,
        isSkipValidation
      );
    } else if (packageType === "Source") {
      result = this.createSourcePackage(
        sfdx_package,
        commit_id,
        repository_url
      );
    } else if (packageType == "Data") {
      result = this.createDataPackage(
        sfdx_package,
        commit_id,
        repository_url
      );
    } else {
      throw new Error(`Unknown package type ${packageType}`)
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


  

    //Create a working directory
    let projectDirectory = SourcePackageGenerator.generateSourcePackageArtifact(null,sfdx_package,ManifestHelpers.getPackageDescriptorFromConfig(sfdx_package,this.projectConfig)["path"],null,config_file_path);

   
    let createUnlockedPackageImpl: CreateUnlockedPackageImpl = new CreateUnlockedPackageImpl(
      sfdx_package,
      null,
      path.join('config','project-scratch-def.json'),
      true,
      null,
      projectDirectory,
      devhub_alias,
      wait_time,
      !isSkipValidation,
      isSkipValidation,
      packageMetadata,
      this.orgDependentPackages.includes(sfdx_package)
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
        true,
        this.buildNumber.toString()
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

    let createSourcePackageImpl = new CreateSourcePackageImpl(
      this.project_directory,
      sfdx_package,
      null,
      packageMetadata
    );
    let result = createSourcePackageImpl.exec();

    return result;
  }

  private async getOrgDependentPackages()
  {
  let orgDependentPackages=[];
  let packageInfo = await this.getPackageInfo();
  packageInfo.forEach(pkg => {
      if(pkg.IsOrgDependent === 'Yes' )
          orgDependentPackages.push(pkg.Name);
    });
    
    return orgDependentPackages;
  }

  private async getUnlockedPacakges()
  {
  let unlockedPackages=[];
  let packageInfo = await this.getPackageInfo();
  packageInfo.forEach(pkg => {
      if(pkg.IsOrgDependent === 'No' )
      unlockedPackages.push(pkg.Name);
    });
    
    return unlockedPackages;
  }


  private  async getPackageInfo()
  {
     if(this.packageInfo==null)
     {
     this.packageInfo = await new PackageVersionListImpl(this.project_directory,this.devhub_alias).exec(); 
     }
     return this.packageInfo;
  }

  
  private createDataPackage(
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
        true,
        this.buildNumber.toString()
      );
      incrementedVersionNumber = incrementBuildNumber.exec();
    }

    let packageMetadata: PackageMetadata = {
      package_name: sfdx_package,
      sourceVersion: commit_id,
      package_version_number: incrementedVersionNumber?.versionNumber,
      repository_url: repository_url,
      package_type: "data"
    };

    let createDataPackageImpl = new CreateDataPackageImpl(
      this.project_directory,
      sfdx_package,
      packageMetadata
    );
    let result = createDataPackageImpl.exec();

    return result;
  }
}
