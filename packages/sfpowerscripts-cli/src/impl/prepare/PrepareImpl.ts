
import { Org } from "@salesforce/core";
import ArtifactGenerator from "@dxatscale/sfpowerscripts.core/lib/generators/ArtifactGenerator";
import PrepareASingleCIOrgImpl from "./PrepareASingleCIOrgImpl";
import BuildImpl, { BuildProps } from "../parallelBuilder/BuildImpl";
import { Stage } from "../Stage";
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";
import FetchAnArtifact from "../artifacts/FetchAnArtifact";
import FetchArtifactSelector  from "../artifacts/FetchArtifactSelector";
import * as rimraf from "rimraf";
import * as fs from "fs-extra";
import PoolCreateImpl from "../pool/PoolCreateImpl";
import { Pool } from "../pool/Pool";



export default class PrepareImpl {
  



  private fetchArtifactScript: string;
  private keys: string;
  private installAll: boolean;
  private installAsSourcePackages: boolean;
  private succeedOnDeploymentErrors: boolean;
  private _isNpm: boolean;
  private _scope: string;
  private _npmTag: string;
  private _npmrcPath: string;
  private _isRetryOnFailure: boolean;
  private _checkPointPackages: string[];



  public constructor(
    private hubOrg: Org,
    private apiversion: string,
    private tag: string,
    private expiry: number,
    private max_allocation: number,
    private configFilePath: string,
    private batchSize: number
  ) {
   
  }

  public setArtifactFetchScript(fetchArtifactScript: string) {
    this.fetchArtifactScript = fetchArtifactScript;
  }

  public setInstallationBehaviour(
    installAll: boolean,
    installAsSourcePackages: boolean,
    succeedOnDeploymentErrors: boolean
  ) {
    this.installAll = installAll;
    this.installAsSourcePackages = installAsSourcePackages;
    this.succeedOnDeploymentErrors = succeedOnDeploymentErrors;
  }

  public setPackageKeys(keys: string) {
    this.keys = keys;
  }

  public set isNpm(npm: boolean) {
    this._isNpm = npm;
  }

  public set scope(scope: string) {
    this._scope = scope;
  }

  public set npmTag(tag: string) {
    this._npmTag = tag;
  }

  public set npmrcPath(path: string) {
    this._npmrcPath = path;
  }

  public set retryOnFailure(isRetryOnFailure: boolean) {
    this._isRetryOnFailure = isRetryOnFailure;
  }

  public async poolScratchOrgs(): Promise<{
    totalallocated: number;
    success: number;
    failed: number;
    errorCode?: string;
  }> {
   
    let pool = await this.createCIPools();
   
    return {
      totalallocated: pool.to_allocate,
      success:pool.scratchOrgs.length,
      failed: pool.failedToCreate
    };
  }


  private async createCIPools():Promise<Pool>
  {
     //Create Artifact Directory
     rimraf.sync("artifacts");
     fs.mkdirpSync("artifacts");
 
     //Fetch Latest Artifacts to Artifact Directory
     if (this.installAll) {
       await this.getPackageArtifacts();
     }
 
     //Get CheckPoint Packages
     this._checkPointPackages = this.getcheckPointPackages();
 
 
     let prepareASingleOrgImpl: PrepareASingleCIOrgImpl = new PrepareASingleCIOrgImpl(
       this._isRetryOnFailure
     );
 
     prepareASingleOrgImpl.setcheckPointPackages(this._checkPointPackages);
     prepareASingleOrgImpl.setInstallationBehaviour(
       this.installAll,
       this.installAsSourcePackages,
       this.succeedOnDeploymentErrors
     );
     prepareASingleOrgImpl.setPackageKeys(this.keys);
 
     let createPool:PoolCreateImpl = new PoolCreateImpl(this.hubOrg,this.tag,this.expiry,this.max_allocation,this.configFilePath,this.batchSize,prepareASingleOrgImpl);
     let pool = await createPool.execute() as Pool;
     return pool;
  }

  //Fetch all checkpoints
  private getcheckPointPackages() {
    console.log("Fetching checkpoints for prepare if any.....");
    let projectConfig = ProjectConfig.getSFDXPackageManifest(null);
    let checkPointPackages = [];
    projectConfig["packageDirectories"].forEach((pkg) => {
      if (pkg.checkpointForPrepare) checkPointPackages.push(pkg["package"]);
    });
    return checkPointPackages;
  }

  private async getPackageArtifacts() {
    let packages = ProjectConfig.getSFDXPackageManifest(null)[
      "packageDirectories"
    ];

    packages.forEach((pkg) => {
      artifactFetcher.fetchArtifact(
        pkg.package,
        "artifacts"
      );
    });

    let artifactFetcher:FetchAnArtifact;
    if (this._isNpm || this.fetchArtifactScript) {
      let version= this._npmTag;
      artifactFetcher = new FetchArtifactSelector(this.fetchArtifactScript,this._scope,this._npmrcPath).getArtifactFetcher();  
      packages.forEach((pkg) => {
        artifactFetcher.fetchArtifact(
          pkg.package,
          "artifacts",
          version
        );
      });
    } else {
      //Build All Artifacts
      console.log("\n");
      console.log(
        "-------------------------------WARNING!!!!------------------------------------------------"
      );
      console.log(
        "Building packages, as script to fetch artifacts was not provided"
      );
      console.log(
        "This is not ideal, as the artifacts are  built from the current head of the provided branch"
      );
      console.log(
        "Pools should be prepared with previously validated packages"
      );
      console.log(
        "---------------------------------------------------------------------------------------------"
      );

      let buildProps: BuildProps = {
        configFilePath: this.configFilePath,
        devhubAlias: this.hubOrg.getUsername(),
        waitTime: 120,
        isQuickBuild: true,
        isDiffCheckEnabled: false,
        buildNumber: 1,
        executorcount: 10,
        isBuildAllAsSourcePackages: true,
        branch: null,
        currentStage: Stage.PREPARE,
      };

      let buildImpl = new BuildImpl(buildProps);
      let { generatedPackages, failedPackages } = await buildImpl.exec();

      if (failedPackages.length > 0)
        throw new Error(
          "Unable to build packages, Following packages failed to build" +
            failedPackages
        );

      for (let generatedPackage of generatedPackages) {
        await ArtifactGenerator.generateArtifact(
          generatedPackage.package_name,
          process.cwd(),
          "artifacts",
          generatedPackage
        );
      }
    }
  }





 



  

}


