
import { Org } from "@salesforce/core";
import { PoolConfig } from "../pool/PoolConfig";
import OrgDisplayImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/OrgDisplayImpl";
import isValidSfdxAuthUrl from "../pool/prequisitecheck/IsValidSfdxAuthUrl";
import SFPLogger, { COLOR_KEY_MESSAGE, LoggerLevel } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import ArtifactGenerator from "@dxatscale/sfpowerscripts.core/lib/generators/ArtifactGenerator";
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";
import { Result } from "neverthrow";
import FetchAnArtifact from "../artifacts/FetchAnArtifact";
import FetchArtifactSelector from "../artifacts/FetchArtifactSelector";
import BuildImpl, { BuildProps } from "../parallelBuilder/BuildImpl";
import PoolCreateImpl from "../pool/PoolCreateImpl";
import { PoolError } from "../pool/PoolError";
import { Stage } from "../Stage";
import PrepareOrgJob from "./PrepareOrgJob";
import * as rimraf from "rimraf";
import * as fs from "fs-extra";


export default class PrepareImpl {


  public constructor(
    private hubOrg: Org,
    private pool:PoolConfig,
    private logLevel:LoggerLevel
  ) {

    // set defaults
    if(!this.pool.expiry) this.pool.expiry = 2;

    if(!this.pool.batchSize) this.pool.batchSize = 5;

  }


  public async exec()
  {


    SFPLogger.log(COLOR_KEY_MESSAGE("Validating Org Authentication Mechanism.."),LoggerLevel.INFO);
    let orgDisplayImpl = new OrgDisplayImpl(null, this.hubOrg.getUsername());
    let orgDisplayResult = await orgDisplayImpl.exec(true);

    if(!(orgDisplayResult.sfdxAuthUrl && isValidSfdxAuthUrl(orgDisplayResult.sfdxAuthUrl)))
      throw new  Error(`Pools have to be created using a DevHub authenticated with auth:web or auth:store or auth:accesstoken:store`);


    return this.poolScratchOrgs();
  }



  private async poolScratchOrgs(): Promise<Result<PoolConfig,PoolError>>{

    //Create Artifact Directory
    rimraf.sync("artifacts");
    fs.mkdirpSync("artifacts");

    if (this.pool.installAll) {
      // Fetch Latest Artifacts to Artifact Directory
      await this.getPackageArtifacts();
    }

    let prepareASingleOrgImpl: PrepareOrgJob = new PrepareOrgJob(
      this.pool
    );

    let createPool: PoolCreateImpl = new PoolCreateImpl(
      this.hubOrg,
      this.pool,
      prepareASingleOrgImpl,
      this.logLevel
    );
    let pool = await createPool.execute();

    return pool
  }




  private async getPackageArtifacts() {


    //Filter Packages to be ignore from prepare to be fetched
    let packages =ProjectConfig.getSFDXPackageManifest(null)[
      "packageDirectories"
    ].filter((pkg)=>{
      if (
        pkg.ignoreOnStage?.find( (stage) => {
          stage = stage.toLowerCase();
          return stage === "prepare";
        })
      )
        return false;
      else
        return true;
    });


    let artifactFetcher:FetchAnArtifact;
    if (this.pool.fetchArtifacts) {
      artifactFetcher = new FetchArtifactSelector(
        this.pool.fetchArtifacts.artifactFetchScript,
        this.pool.fetchArtifacts.npm?.scope,
        this.pool.fetchArtifacts.npm?.npmrcPath
      ).getArtifactFetcher();


      packages.forEach((pkg) => {
        artifactFetcher.fetchArtifact(
          pkg.package,
          "artifacts",
          this.pool.fetchArtifacts.npm ? this.pool.fetchArtifacts.npm.npmtag : null
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
