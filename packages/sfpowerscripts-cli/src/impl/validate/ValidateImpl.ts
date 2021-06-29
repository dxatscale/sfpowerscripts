import child_process = require("child_process");
import BuildImpl, { BuildProps } from "../parallelBuilder/BuildImpl";
import DeployImpl, { DeploymentMode, DeployProps } from "../deploy/DeployImpl";
import ArtifactGenerator from "@dxatscale/sfpowerscripts.core/lib/generators/ArtifactGenerator";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import { Stage } from "../Stage";
import SFPLogger, { LoggerLevel } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import fs = require("fs");
import InstallPackageDependenciesImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallPackageDependenciesImpl";
import { PackageInstallationStatus } from "@dxatscale/sfpowerscripts.core/lib/package/PackageInstallationResult";
import PoolFetchImpl from "../pool/PoolFetchImpl";
import { Org } from "@salesforce/core";
import { ScratchOrg } from "../pool/utils/ScratchOrgUtils";
import DependencyAnalysis from "./DependencyAnalysis";
const Table = require("cli-table");
import InstalledArtifactsFetcher from "@dxatscale/sfpowerscripts.core/lib/artifacts/InstalledAritfactsFetcher";
import { COLOR_KEY_MESSAGE } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import { COLOR_WARNING } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import { COLOR_ERROR } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import { COLOR_HEADER } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import { COLOR_SUCCESS } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import getFormattedTime from "../../utils/GetFormattedTime";
import { COLOR_TIME } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";

export enum ValidateMode {
  ORG,
  POOL
}

export interface ValidateProps {
  validateMode: ValidateMode,
  coverageThreshold: number,
  logsGroupSymbol: string[],
  targetOrg?: string,
  devHubUsername?: string,
  pools?: string[],
  jwt_key_file?: string,
  client_id?: string,
  shapeFile?: string,
  isDeleteScratchOrg?: boolean,
  keys?: string,
  visualizeChangesAgainst?: string
}

export default class ValidateImpl {

  constructor (
    private props: ValidateProps
  ){}

  public async exec(): Promise<boolean>{
    let scratchOrgUsername: string;
    try {
      let authDetails;
      if (this.props.validateMode === ValidateMode.ORG) {
        scratchOrgUsername = this.props.targetOrg;

        //TODO: get accessToken and instanceURL for scratch org
      } else if (this.props.validateMode === ValidateMode.POOL) {
        this.authenticateDevHub(this.props.devHubUsername);

        scratchOrgUsername = await this.fetchScratchOrgFromPool(
          this.props.pools,
          this.props.devHubUsername
        );

        authDetails = this.authenticateToScratchOrg(scratchOrgUsername);

        if (this.props.shapeFile) {
          this.deployShapeFile(this.props.shapeFile, scratchOrgUsername);
        }
        await this.installPackageDependencies(scratchOrgUsername);
      } else throw new Error(`Unknown mode ${this.props.validateMode}`);

      let installedArtifacts;
      try {
        installedArtifacts = await InstalledArtifactsFetcher.getListofArtifacts(scratchOrgUsername);
      } catch {
        console.log(COLOR_ERROR("Failed to query org for Sfpowerscripts Artifacts"));
        console.log(COLOR_KEY_MESSAGE("Building all packages"));
      }

      let packagesToCommits: {[p: string]: string} = {};

      if (installedArtifacts != null) {
        packagesToCommits = this.getPackagesToCommits(installedArtifacts);
        this.printArtifactVersions(installedArtifacts);
      }

      await this.buildChangedSourcePackages(packagesToCommits);

      // Un-suppress logs for deployment
      SFPLogger.logLevel = LoggerLevel.INFO;

      let deploymentResult = await this.deploySourcePackages(scratchOrgUsername);

      if (deploymentResult.failed.length > 0 || deploymentResult.error)
        return false;
      else {
        if (this.props.visualizeChangesAgainst) {
          try {
            let dependencyAnalysis: DependencyAnalysis = new DependencyAnalysis(
              this.props.visualizeChangesAgainst,
              authDetails
            );
            await dependencyAnalysis.exec();
          } catch(err){
            console.log(err.message);
            console.log("Failed to perform change analysis");
          }
        }
        return true;
      }
    } finally {
      if (this.props.isDeleteScratchOrg) {
        this.deleteScratchOrg(scratchOrgUsername);
      } else {
          fs.writeFileSync(
            ".env",
            `sfpowerscripts_scratchorg_username=${scratchOrgUsername}\n`,
            { flag: "a" }
          );
          console.log(
            `sfpowerscripts_scratchorg_username=${scratchOrgUsername}`
          );
        }
    }

  }

  private async installPackageDependencies(scratchOrgUsername: string) {
    this.printOpenLoggingGroup(`Installing Package Dependencies of this repo in ${scratchOrgUsername}`);

    // Install Dependencies
    let installDependencies: InstallPackageDependenciesImpl = new InstallPackageDependenciesImpl(
      scratchOrgUsername,
      this.props.devHubUsername,
      120,
      null,
      this.props.keys,
      true,
      null
    );
    let installationResult = await installDependencies.exec();
    if (installationResult.result == PackageInstallationStatus.Failed) {
      throw new Error(installationResult.message);
    }
    console.log(COLOR_KEY_MESSAGE(`Successfully completed Installing Package Dependencies of this repo in ${scratchOrgUsername}`));
    this.printClosingLoggingGroup();
  }

  private deleteScratchOrg(scratchOrgUsername: string): void {
    try {
      if (scratchOrgUsername && this.props.devHubUsername ) {
          console.log(`Deleting scratch org`, scratchOrgUsername);
          child_process.execSync(
            `sfdx force:org:delete -p -u ${scratchOrgUsername} -v ${this.props.devHubUsername}`,
            {
              stdio: 'inherit',
              encoding: 'utf8'
            }
          );
      }
    } catch (error) {
      console.log(COLOR_WARNING(error.message));
    }
  }

  private authenticateDevHub(devHubUsername: string): void {
    child_process.execSync(
      `sfdx auth:jwt:grant -u ${devHubUsername} -i ${this.props.client_id} -f ${this.props.jwt_key_file} -r https://login.salesforce.com`,
      {
        stdio: "inherit",
        encoding: "utf8"
      }
    );
  }

  private deployShapeFile(shapeFile: string, scratchOrgUsername: string): void {
    console.log(COLOR_KEY_MESSAGE(`Deploying scratch org shape`), shapeFile);
    child_process.execSync(
      `sfdx force:mdapi:deploy -f ${shapeFile} -u ${scratchOrgUsername} -w 30 --ignorewarnings`,
      {
        stdio: 'inherit',
        encoding: 'utf8'
      }
    );
  }

  private async deploySourcePackages(scratchOrgUsername: string): Promise<{
    deployed: string[],
    failed: string[],
    testFailure: string,
    error: any
  }> {
    let deployStartTime: number = Date.now();

    let deployProps: DeployProps = {
       targetUsername : scratchOrgUsername,
       artifactDir : "artifacts",
       waitTime:120,
       deploymentMode:DeploymentMode.SOURCEPACKAGES,
       isTestsToBeTriggered:true,
       skipIfPackageInstalled:false,
       coverageThreshold:this.props.coverageThreshold,
       logsGroupSymbol:this.props.logsGroupSymbol,
       currentStage:Stage.VALIDATE,
    }


    let deployImpl: DeployImpl = new DeployImpl(
     deployProps
    );

    let deploymentResult = await deployImpl.exec();

    let deploymentElapsedTime: number = Date.now() - deployStartTime;
    this.printDeploySummary(deploymentResult, deploymentElapsedTime);

    return deploymentResult;
  }

  private async buildChangedSourcePackages(packagesToCommits: { [p: string]: string; }): Promise<any> {
    let buildStartTime: number = Date.now();


     let buildProps:BuildProps = {
       buildNumber:1,
       executorcount:10,
       waitTime:120,
       isDiffCheckEnabled:true,
       isQuickBuild:true,
       isBuildAllAsSourcePackages:true,
       packagesToCommits:packagesToCommits,
       currentStage:Stage.VALIDATE
     }



    let buildImpl: BuildImpl = new BuildImpl(buildProps);

    let { generatedPackages, failedPackages } = await buildImpl.exec();


    if (failedPackages.length > 0)
      throw new Error(`Failed to create source packages ${failedPackages}`);


    if(generatedPackages.length === 0) {
      throw new Error(`No changes detected in the packages to be built \n, validate will only execute if there is a change in atleast one of the packages`);
    }

    for (let generatedPackage of generatedPackages) {
      try {
        await ArtifactGenerator.generateArtifact(
          generatedPackage.package_name,
          process.cwd(),
          "artifacts",
          generatedPackage
        );
      } catch (error) {
        console.log(
          COLOR_ERROR(`Unable to create artifact for ${generatedPackage.package_name}`)
        );
        throw error;
      }
    }
    let buildElapsedTime: number = Date.now() - buildStartTime;

    this.printBuildSummary(generatedPackages, failedPackages, buildElapsedTime);

    return generatedPackages;
  }

  private getPackagesToCommits(installedArtifacts: any): {[p: string]: string} {
    let packagesToCommits: {[p: string]: string} = {};

    // Construct map of artifact and associated commit Id
    installedArtifacts.forEach((artifact) => {
      packagesToCommits[artifact.Name] = artifact.CommitId__c;
    });

    return packagesToCommits;
  }

  private printArtifactVersions(installedArtifacts: any) {
    this.printOpenLoggingGroup(`Artifacts installed in the Scratch Org`);
    let table = new Table({
      head: ["Artifact", "Version", "Commit Id"],
    });

    installedArtifacts.forEach((artifact) => {
      table.push([artifact.Name, artifact.Version__c, artifact.CommitId__c]);
    });

    console.log(COLOR_KEY_MESSAGE(`Artifacts installed in scratch org:`));
    console.log(table.toString());
    this.printClosingLoggingGroup();
  }

  /**
   * Authenticate to scratch org and return auth details:
   * username, accessToken, orgId, loginUrl, privateKey, clientId and instanceUrl
   * @param scratchOrgUsername
   */
  private authenticateToScratchOrg(scratchOrgUsername: string) {
    try {
      let grantJson = child_process.execSync(
        `sfdx auth:jwt:grant -u ${scratchOrgUsername} -i ${this.props.client_id} -f ${this.props.jwt_key_file} -r https://test.salesforce.com --json`,
        {
          stdio: "pipe",
          encoding: "utf8"
        }
      );
      let grant = JSON.parse(grantJson);
      console.log(COLOR_KEY_MESSAGE(`Successfully authorized ${grant.result.username} with org ID ${grant.result.orgId}`));
      return grant.result;
    } catch (err) {
      throw new Error(`Failed to authenticate to ${scratchOrgUsername}`);
    }
  }

  private  async fetchScratchOrgFromPool(pools: string[], devHubUsername: string): Promise<string> {
    let scratchOrgUsername: string;

    for (let pool of pools) {
      let scratchOrg:ScratchOrg
      try {
        let hubOrg:Org = await Org.create({aliasOrUsername:devHubUsername,isDevHub:true});

        let poolFetchImpl = new PoolFetchImpl(hubOrg,pool.trim(),false);
        scratchOrg = await poolFetchImpl.execute();

      } catch (error) {}

      if (scratchOrg && scratchOrg.status==="Assigned") {
          scratchOrgUsername = scratchOrg.username;
          console.log(`Fetched scratch org ${scratchOrgUsername} from ${pool}`);
          break;
        }
    }

    if (scratchOrgUsername)
      return scratchOrgUsername;
    else
      throw new Error(`Failed to fetch scratch org from ${pools}`);
  }

  private printBuildSummary(
    generatedPackages: PackageMetadata[],
    failedPackages: string[],
    totalElapsedTime: number
  ): void {
    console.log(COLOR_HEADER(
      `----------------------------------------------------------------------------------------------------`
    ));
    console.log(COLOR_SUCCESS(
      `${generatedPackages.length} packages created in ${COLOR_TIME(getFormattedTime(totalElapsedTime))} with {${COLOR_ERROR(failedPackages.length)}} errors`
    ));


    if (failedPackages.length > 0) {
      console.log(COLOR_ERROR(`Packages Failed To Build`, failedPackages));
    }
    console.log(COLOR_HEADER(
      `----------------------------------------------------------------------------------------------------`
    ));
  }

  private printDeploySummary(
    deploymentResult: {deployed: string[], failed: string[], testFailure: string},
    totalElapsedTime: number
  ): void {
    if (this.props.logsGroupSymbol?.[0])
      console.log(this.props.logsGroupSymbol[0], "Deployment Summary");

    console.log(COLOR_HEADER(
      `----------------------------------------------------------------------------------------------------`
    ));
    console.log(COLOR_SUCCESS(
      `${deploymentResult.deployed.length} packages deployed in ${COLOR_TIME(getFormattedTime(totalElapsedTime)
      )} with {${COLOR_ERROR(deploymentResult.failed.length)}} failed deployments`
    ));

    if (deploymentResult.testFailure)
      console.log(COLOR_ERROR(`\nTests failed for`, deploymentResult.testFailure));


    if (deploymentResult.failed.length > 0) {
      console.log(COLOR_ERROR(`\nPackages Failed to Deploy`, deploymentResult.failed));
    }
    console.log(COLOR_HEADER(
      `----------------------------------------------------------------------------------------------------`
    ));
    this.printClosingLoggingGroup();
  }

  private printOpenLoggingGroup(message:string) {
    if (this.props.logsGroupSymbol?.[0])
      SFPLogger.log(
        `${this.props.logsGroupSymbol[0]} ${message}`,
        LoggerLevel.INFO
      );
  }

  private printClosingLoggingGroup() {
    if (this.props.logsGroupSymbol?.[1])
      SFPLogger.log(
        this.props.logsGroupSymbol[1],
        LoggerLevel.INFO
      );
  }

}
