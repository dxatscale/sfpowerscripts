
import { Org } from "@salesforce/core";
import PrepareOrgJob from "./PrepareOrgJob";
import BuildImpl, { BuildProps } from "../parallelBuilder/BuildImpl";
import { Stage } from "../Stage";
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";
import FetchAnArtifact from "../artifacts/FetchAnArtifact";
import FetchArtifactSelector  from "../artifacts/FetchArtifactSelector";
import * as rimraf from "rimraf";
import * as fs from "fs-extra";
import PoolCreateImpl from "../pool/PoolCreateImpl";
import { PoolConfig } from "../pool/PoolConfig";
import ArtifactGenerator from "@dxatscale/sfpowerscripts.core/lib/generators/ArtifactGenerator";
import { PreparePoolInterface } from "./PreparePoolInterface";
import { PoolError } from "../pool/PoolError";
import { Result} from "neverthrow"
import ArtifactFilePathFetcher, {
  ArtifactFilePaths,
} from "@dxatscale/sfpowerscripts.core/lib/artifacts/ArtifactFilePathFetcher";


export default class PreparePool implements PreparePoolInterface  {


  public constructor(
    private hubOrg: Org,
    private pool:PoolConfig
  ) {

  }


  public async poolScratchOrgs(): Promise<Result<PoolConfig,PoolError>>{

    let pool = await this.createPools();

     return pool;
  }


  private async createPools():Promise<Result<PoolConfig,PoolError>>
  {
    //Create Artifact Directory
    rimraf.sync("artifacts");
    fs.mkdirpSync("artifacts");

    let artifacts: ArtifactFilePaths[];
    if (this.pool.installAll) {
      // Fetch Latest Artifacts to Artifact Directory
      await this.getPackageArtifacts();

      artifacts = ArtifactFilePathFetcher.fetchArtifactFilePaths("artifacts");
    }

    let prepareASingleOrgImpl: PrepareOrgJob = new PrepareOrgJob(
      this.pool,
      artifacts
    );

    let createPool: PoolCreateImpl = new PoolCreateImpl(
      this.hubOrg,
      this.pool,
      prepareASingleOrgImpl
    );
    let pool = await createPool.execute();

    return pool
  }



  private async getPackageArtifacts() {
    let packages = ProjectConfig.getSFDXPackageManifest(null)[
      "packageDirectories"
    ];


    let artifactFetcher:FetchAnArtifact;
    if (this.pool.fetchArtifacts?.npm || this.pool.fetchArtifacts?.artifactFetchScript) {
      let version= this.pool.fetchArtifacts.npm.npmtag;
      artifactFetcher = new FetchArtifactSelector(
        this.pool.fetchArtifacts.artifactFetchScript,
        this.pool.fetchArtifacts.npm.scope,
        this.pool.fetchArtifacts.npm.npmrcPath
      ).getArtifactFetcher();

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
