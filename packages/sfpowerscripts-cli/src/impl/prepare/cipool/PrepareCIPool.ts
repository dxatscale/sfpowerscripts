
import { Org } from "@salesforce/core";
import PrepareCIOrgJob from "./PrepareCIOrgJob";
import BuildImpl, { BuildProps } from "../../parallelBuilder/BuildImpl";
import { Stage } from "../../Stage";
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";
import FetchAnArtifact from "../../artifacts/FetchAnArtifact";
import FetchArtifactSelector  from "../../artifacts/FetchArtifactSelector";
import * as rimraf from "rimraf";
import * as fs from "fs-extra";
import PoolCreateImpl from "../../pool/PoolCreateImpl";
import { PoolConfig } from "../../pool/PoolConfig";
import ArtifactGenerator from "@dxatscale/sfpowerscripts.core/lib/generators/ArtifactGenerator";
import { PreparePool } from "../PreparePool";




export default class PrepareCIPool implements PreparePool  {


  public constructor(
    private hubOrg: Org,
    private pool:PoolConfig
  ) {
   
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


  private async createCIPools():Promise<PoolConfig>
  {
     //Create Artifact Directory
     rimraf.sync("artifacts");
     fs.mkdirpSync("artifacts");
 
     //Fetch Latest Artifacts to Artifact Directory
     if (this.pool.cipool.installAll) {
       await this.getPackageArtifacts();
     }
 
     let prepareASingleOrgImpl: PrepareCIOrgJob = new PrepareCIOrgJob( this.pool
     );
 
     let createPool:PoolCreateImpl = new PoolCreateImpl(this.hubOrg,this.pool,prepareASingleOrgImpl);
     let pool = await createPool.execute() as PoolConfig;
     return pool;
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
    if (this.pool.cipool.fetchArtifacts.npm || this.pool.cipool.fetchArtifacts.artifactFetchScript) {
      let version= this.pool.cipool.fetchArtifacts.npm.npmtag;
      artifactFetcher = new FetchArtifactSelector(this.pool.cipool.fetchArtifacts.artifactFetchScript,this.pool.cipool.fetchArtifacts.npm.scope,this.pool.cipool.fetchArtifacts.npm.npmrcPath).getArtifactFetcher();  
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
        configFilePath: this.pool.configFilePath,
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


