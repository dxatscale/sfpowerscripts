import BatchingTopoSort from "./BatchingTopoSort";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import DependencyHelper from "./DependencyHelper";
import Bottleneck from "bottleneck";
import PackageDiffImpl from "@dxatscale/sfpowerscripts.core/lib/package/PackageDiffImpl";
import simplegit from "simple-git";
import IncrementProjectBuildNumberImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/IncrementProjectBuildNumberImpl";
import { EOL } from "os";
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender";
import { Stage } from "../Stage";
import * as fs from "fs-extra"
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";
import CreateUnlockedPackageImpl from "@dxatscale/sfpowerscripts.core/lib/package/packageCreators/CreateUnlockedPackageImpl"
import CreateSourcePackageImpl from "@dxatscale/sfpowerscripts.core/lib/package/packageCreators/CreateSourcePackageImpl"
import CreateDataPackageImpl from "@dxatscale/sfpowerscripts.core/lib/package/packageCreators/CreateDataPackageImpl"
import BuildCollections from "./BuildCollections";
const Table = require("cli-table");
import { ConsoleLogger, FileLogger, VoidLogger} from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger"
import { COLOR_KEY_MESSAGE } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import { COLOR_HEADER } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import { COLOR_ERROR } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";

const PRIORITY_UNLOCKED_PKG_WITH_DEPENDENCY = 1;
const PRIORITY_UNLOCKED_PKG_WITHOUT_DEPENDENCY = 3;
const PRIORITY_SOURCE_PKG = 5;
const PRIORITY_DATA_PKG = 5;

export interface BuildProps {
  configFilePath?: string,
  projectDirectory?: string,
  devhubAlias?: string,
  repourl?: string,
  waitTime: number,
  isQuickBuild: boolean,
  isDiffCheckEnabled: boolean,
  buildNumber: number,
  executorcount: number,
  isBuildAllAsSourcePackages: boolean,
  branch?:string,
  packagesToCommits?: {[p: string]: string},
  currentStage:Stage
}
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



  private recursiveAll = (a) =>
    Promise.all(a).then((r) =>
      r.length == a.length ? r : this.recursiveAll(a)
    );


  public constructor(
    private props:BuildProps
  ) {
    this.limiter = new Bottleneck({
      maxConcurrent: this.props.executorcount,
    });

    this.packagesBuilt = [];
    this.failedPackages = [];
    this.generatedPackages = [];
    this.packageCreationPromises = new Array();
  }

  public async exec(): Promise<{
    generatedPackages: PackageMetadata[];
    failedPackages: string[];
  }> {
    this.packagesToBeBuilt = this.getAllPackages(
      this.props.projectDirectory
    );

    this.validatePackageNames(this.packagesToBeBuilt);



    // Read Manifest
    this.projectConfig = ProjectConfig.getSFDXPackageManifest(
      this.props.projectDirectory
    );




    //Do a diff Impl
    let table;
    if (this.props.isDiffCheckEnabled) {
       let packagesToBeBuiltWithReasons= await this.getListOfOnlyChangedPackages(this.props.projectDirectory,this.packagesToBeBuilt);
       table = this.createDiffPackageScheduledDisplayedAsATable(packagesToBeBuiltWithReasons);
       this.packagesToBeBuilt=Array.from(packagesToBeBuiltWithReasons.keys()); //Assign it back to the instance variable
    }
    else
    {
      table = this.createAllPackageScheduledDisplayedAsATable();
    }
    //Log Packages to be built
    console.log(COLOR_KEY_MESSAGE("Packages scheduled for build"))
    console.log(table.toString());

    for await (const pkg of this.packagesToBeBuilt) {

      let type = this.getPriorityandTypeOfAPackage(
        this.projectConfig,
        pkg
      ).type;
      SFPStatsSender.logCount("build.scheduled.packages", {
        package: pkg,
        type: type,
        is_diffcheck_enabled: String(this.props.isDiffCheckEnabled),
        is_dependency_validated: this.props.isQuickBuild ? "false" : "true",
        pr_mode: String(this.props.isBuildAllAsSourcePackages),
      });
    }

    if (this.packagesToBeBuilt.length == 0)
      return {
        generatedPackages: this.generatedPackages,
        failedPackages: this.failedPackages,
      };

    this.childs = DependencyHelper.getChildsOfAllPackages(
      this.props.projectDirectory,
      this.packagesToBeBuilt
    );

    this.parents = DependencyHelper.getParentsOfAllPackages(
      this.props.projectDirectory,
      this.packagesToBeBuilt
    );

    this.parentsToBeFulfilled = DependencyHelper.getParentsToBeFullFilled(
      this.parents,
      this.packagesToBeBuilt
    );

    let sortedBatch = new BatchingTopoSort().sort(this.childs);

    //Do First Level Package First
    let pushedPackages = [];
    for (const pkg of sortedBatch[0]) {
      let { priority, type } = this.getPriorityandTypeOfAPackage(
        this.projectConfig,
        pkg
      );
      let packagePromise: Promise<PackageMetadata> = this.limiter
        .schedule({ id: pkg, priority: priority }, () =>
          this.createPackage(
            type,
            pkg,
            this.props.configFilePath,
            this.props.devhubAlias,
            this.props.waitTime.toString(),
            this.props.isQuickBuild,
            this.props.isBuildAllAsSourcePackages
          )
        )
        .then(
          (packageMetadata: PackageMetadata) => {
            this.generatedPackages.push(packageMetadata);
            SFPStatsSender.logCount("build.succeeded.packages", {
              package: pkg,
              type: type,
              is_diffcheck_enabled: String(this.props.isDiffCheckEnabled),
              is_dependency_validated: this.props.isQuickBuild ? "false" : "true",
              pr_mode: String(this.props.isBuildAllAsSourcePackages),
            });
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

    return {
      generatedPackages: this.generatedPackages,
      failedPackages: this.failedPackages,
    };
  }

  private createDiffPackageScheduledDisplayedAsATable(packagesToBeBuilt: Map<string, any>) {
    let table = new Table({
      head: ["Package", "Reason to be built", "Last Known Tag"],
    });
    for (const pkg of packagesToBeBuilt.keys()) {
      let item = [pkg, packagesToBeBuilt.get(pkg).reason, packagesToBeBuilt.get(pkg).tag ? packagesToBeBuilt.get(pkg).tag : ""];
      table.push(item);
    }
    return table;
  }

  private createAllPackageScheduledDisplayedAsATable() {
    let table = new Table({
      head: ["Package", "Reason to be built"],
    });
    for (const pkg of this.packagesToBeBuilt) {
      let item = [pkg, "Activated as part of all package build"];
      table.push(item);
    }
    return table;
  }

  private async getListOfOnlyChangedPackages(projectDirectory:string,allPackagesInRepo:any) {
    let packagesToBeBuilt = new Map<string, any>();
    let buildCollections = new BuildCollections(projectDirectory);

    for await (const pkg of allPackagesInRepo) {
      let diffImpl: PackageDiffImpl = new PackageDiffImpl(
        new ConsoleLogger(),
        pkg,
        this.props.projectDirectory,
        this.props.packagesToCommits,
        this.getPathToForceIgnoreForCurrentStage(this.projectConfig, this.props.currentStage)
      );
      let packageDiffCheck = await diffImpl.exec();

      if (packageDiffCheck.isToBeBuilt) {
        packagesToBeBuilt.set(pkg,{reason:packageDiffCheck.reason,tag:packageDiffCheck.tag});
        //Add Bundles
        if (buildCollections.isPackageInACollection(pkg)) {
          buildCollections.listPackagesInCollection(pkg).forEach((packageInCollection) => {
            if (!packagesToBeBuilt.has(packageInCollection)) {
              packagesToBeBuilt.set(packageInCollection, {reason:"Part of a build collection"});
            }
          });
        }
      }
    }
    return packagesToBeBuilt;
  }

  /**
   * Validate that package names comply with naming convention
   * @param packageNames
   */
  private validatePackageNames(packageNames: string[]) {
    packageNames.forEach((name) => {
      if (name.match(/^[a-zA-Z0-9-._~]+$/) === null)
        throw new Error(`Invalid package name "${name}". Package names can only contain alphanumeric characters and the symbols - . _ ~`);
    });
  }

  private getAllPackages(projectDirectory: string): string[] {

      let projectConfig = ProjectConfig.getSFDXPackageManifest(projectDirectory);
      let sfdxpackages=[];


      let packageDescriptors =projectConfig["packageDirectories"].filter((pkg)=>{
        if (
          pkg.ignoreOnStage?.find( (stage) => {
            stage = stage.toLowerCase();
            return stage === this.props.currentStage;
          })
        )
          return false;
        else
          return true;
      });

      // Ignore aliasfied packages on validate & prepare stages
      packageDescriptors = packageDescriptors.filter((pkg) => {
        return !(
          (this.props.currentStage === "prepare" ||
            this.props.currentStage === "validate") &&
          pkg.aliasfy &&
          pkg.type !== "data"
        );
      });

      for (const pkg of packageDescriptors) {
      sfdxpackages.push(pkg["package"]);
    }
    return sfdxpackages;
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

  private handlePackageError(reason: any, pkg: string): any {
    console.log(COLOR_HEADER(`${EOL}-----------------------------------------`));
    console.log(COLOR_ERROR(`Package Creation Failed for ${pkg}`));
    try {
      // Append error to log file
      fs.appendFileSync(`.sfpowerscripts/logs/${pkg}`, reason.message, 'utf8');

      let data = fs.readFileSync(`.sfpowerscripts/logs/${pkg}`, "utf8");
      console.log(data);
    } catch (e) {
      console.log(`Unable to display logs for pkg ${pkg}`);
    }

    //Remove the package from packages To Be Built
    this.packagesToBeBuilt = this.packagesToBeBuilt.filter((el) => {
      if (el == pkg) return false;
      else return true;
    });
    this.packagesInQueue = this.packagesInQueue.filter((pkg_name) => {
      if (pkg == pkg_name) return false;
      else return true;
    });

    //Remove myself and my  childs
    this.failedPackages.push(pkg);
    SFPStatsSender.logCount("build.failed.packages", { package: pkg });
    this.packagesToBeBuilt = this.packagesToBeBuilt.filter((pkg) => {
      if (this.childs[pkg].includes(pkg)) {
        this.childs[pkg].forEach((removedChilds) => {
          SFPStatsSender.logCount("build.failed.packages", {
            package: removedChilds,
          });
        });
        this.failedPackages.push(this.childs[pkg]);
        return false;
      }
    });
    console.log(COLOR_KEY_MESSAGE(`${EOL}Removed all childs of ${pkg} from queue`));
    console.log(COLOR_HEADER(`${EOL}-----------------------------------------`));
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
        let { priority, type } = this.getPriorityandTypeOfAPackage(
          this.projectConfig,
          pkg
        );
        let packagePromise: Promise<PackageMetadata> = this.limiter
          .schedule({ id: pkg, priority: priority }, () =>
            this.createPackage(
              type,
              pkg,
              this.props.configFilePath,
              this.props.devhubAlias,
              this.props.waitTime.toString(),
              this.props.isQuickBuild,
              this.props.isBuildAllAsSourcePackages
            )
          )
          .then(
            (packageMetadata: PackageMetadata) => {
              SFPStatsSender.logCount("build.succeeded.packages", {
                package: pkg,
                type: type,
                is_diffcheck_enabled: String(this.props.isDiffCheckEnabled),
                is_dependency_validated: this.props.isQuickBuild ? "false" : "true",
                pr_mode: String(this.props.isBuildAllAsSourcePackages),
              });
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
      console.log(COLOR_KEY_MESSAGE(
        `${EOL}Packages being pushed to the queue:{${pushedPackages.length}} `,
        `${pushedPackages}`
      ));
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

  private getPriorityandTypeOfAPackage(projectConfig: any, pkg: string) {
    let priority = 0;
    let childs = DependencyHelper.getChildsOfAllPackages(
      this.props.projectDirectory,
      this.packagesToBeBuilt
    );
    let type = ProjectConfig.getPackageType(projectConfig, pkg);
    if (type === "Unlocked") {
      if (childs[pkg].length > 0)
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
      COLOR_HEADER(`${EOL}${
        packageMetadata.package_name
      } package created in ${this.getFormattedTime(
        packageMetadata.creation_details.creation_time
      )}`
    ));
    console.log(COLOR_HEADER(`-- Package Details:--`));
    console.log(
      COLOR_HEADER(`-- Package Version Number:        `),
      COLOR_KEY_MESSAGE(packageMetadata.package_version_number)
    );

    if (packageMetadata.package_type !== "data") {
      if (packageMetadata.package_type == "unlocked") {
        console.log(
          COLOR_HEADER(`-- Package Version Id:             `),
          COLOR_KEY_MESSAGE(packageMetadata.package_version_id)
        );
        console.log(
          COLOR_HEADER(`-- Package Test Coverage:          `),
          COLOR_KEY_MESSAGE(packageMetadata.test_coverage)
        );
        console.log(
          COLOR_HEADER(`-- Package Coverage Check Passed:  `),
          COLOR_KEY_MESSAGE(packageMetadata.has_passed_coverage_check)
        );
      }

      console.log(
        COLOR_HEADER(`-- Apex In Package:             `),
        COLOR_KEY_MESSAGE(packageMetadata.isApexFound ? "Yes" : "No")
      );
      console.log(
        COLOR_HEADER(`-- Profiles In Package:         `),
        COLOR_KEY_MESSAGE(packageMetadata.isProfilesFound ? "Yes" : "No")
      );
      console.log(
        COLOR_HEADER(`-- Metadata Count:         `),
        COLOR_KEY_MESSAGE(packageMetadata.metadataCount)
      );
    }
  }

  private async createPackage(
    packageType: string,
    sfdx_package: string,
    config_file_path: string,
    devhub_alias: string,
    wait_time: string,
    isSkipValidation: boolean,
    isValidateMode: boolean
  ): Promise<PackageMetadata> {
    let repository_url: string;
    const git = simplegit();
    if (this.props.repourl == null) {
      repository_url = (await git.getConfig("remote.origin.url")).value;
    } else repository_url = this.props.repourl;

    let commit_id = await git.revparse(['HEAD']);

    console.log(COLOR_KEY_MESSAGE(`Package creation initiated for  ${sfdx_package}`));

    let result: PackageMetadata;
    if (!isValidateMode) {
      if (packageType === "Unlocked") {
        result = await this.createUnlockedPackage(
          sfdx_package,
          commit_id,
          repository_url,
          config_file_path,
          devhub_alias,
          wait_time,
          isSkipValidation
        );
      } else if (packageType === "Source") {
        result = await this.createSourcePackage(
          sfdx_package,
          commit_id,
          repository_url
        );
      } else if (packageType == "Data") {
        result = await this.createDataPackage(
          sfdx_package,
          commit_id,
          repository_url
        );
      } else {
        throw new Error(`Unknown package type ${packageType}`);
      }
    } else {
      if (packageType === "Source" || packageType == "Unlocked") {
        result = await this.createSourcePackage(
          sfdx_package,
          commit_id,
          repository_url
        );
      } else if (packageType == "Data") {
        result = await this.createDataPackage(
          sfdx_package,
          commit_id,
          repository_url
        );
      }
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
      branch:this.props.branch
    };

    let createUnlockedPackageImpl: CreateUnlockedPackageImpl = new CreateUnlockedPackageImpl(
      sfdx_package,
      null,
      this.props.configFilePath,
      true,
      null,
      this.props.projectDirectory,
      devhub_alias,
      wait_time,
      !isSkipValidation,
      isSkipValidation,
      packageMetadata,
      this.getPathToForceIgnoreForCurrentStage(this.projectConfig, this.props.currentStage),
      new FileLogger(`.sfpowerscripts/logs/${sfdx_package}`)
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
    if (this.props.buildNumber) {
      let incrementBuildNumber = new IncrementProjectBuildNumberImpl(
        new VoidLogger(),
        this.props.projectDirectory,
        sfdx_package,
        "BuildNumber",
        true,
        this.props.buildNumber.toString()
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
      branch:this.props.branch
    };

    let createSourcePackageImpl = new CreateSourcePackageImpl(
      this.props.projectDirectory,
      sfdx_package,
      packageMetadata,
      false,
      new FileLogger(`.sfpowerscripts/logs/${sfdx_package}`),
      this.getPathToForceIgnoreForCurrentStage(this.projectConfig, this.props.currentStage)
    );
    let result = createSourcePackageImpl.exec();

    return result;
  }

  private createDataPackage(
    sfdx_package: string,
    commit_id: string,
    repository_url: string
  ): Promise<PackageMetadata> {
    let incrementedVersionNumber;
    if (this.props.buildNumber) {
      let incrementBuildNumber = new IncrementProjectBuildNumberImpl(
        new VoidLogger(),
        this.props.projectDirectory,
        sfdx_package,
        "BuildNumber",
        true,
        this.props.buildNumber.toString()
      );
      incrementedVersionNumber = incrementBuildNumber.exec();
    }

    let packageMetadata: PackageMetadata = {
      package_name: sfdx_package,
      sourceVersion: commit_id,
      package_version_number: incrementedVersionNumber?.versionNumber,
      repository_url: repository_url,
      package_type: "data",
      branch:this.props.branch
    };

    let createDataPackageImpl = new CreateDataPackageImpl(
      this.props.projectDirectory,
      sfdx_package,
      packageMetadata,
      false,
      new FileLogger(`.sfpowerscripts/logs/${sfdx_package}`)
    );
    let result = createDataPackageImpl.exec();

    return result;
  }

  /**
   * Get the file path of the forceignore for current stage, from project config.
   * Returns null if a forceignore path is not defined in the project config for the current stage.
   *
   * @param projectConfig
   * @param currentStage
   */
  private getPathToForceIgnoreForCurrentStage(projectConfig: any, currentStage: Stage): string {
    let stageForceIgnorePath: string;

    let ignoreFiles: {[key in Stage]: string} = projectConfig.plugins?.sfpowerscripts?.ignoreFiles;
    if (ignoreFiles) {
      Object.keys(ignoreFiles).forEach((key) => {
        if (key.toLowerCase() == currentStage) {
          stageForceIgnorePath = ignoreFiles[key];
        }
      });
    }

    if (stageForceIgnorePath) {
      if (fs.existsSync(stageForceIgnorePath)) {
        return stageForceIgnorePath;
      } else throw new Error(`${stageForceIgnorePath} forceignore file does not exist`);
    } else return null;
  }

  private getFormattedTime(milliseconds: number): string {
    let date = new Date(0);
    date.setSeconds(milliseconds / 1000); // specify value for SECONDS here
    let timeString = date.toISOString().substr(11, 8);
    return timeString;
  }
}
