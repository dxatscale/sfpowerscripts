import child_process = require("child_process");
import BuildImpl, { BuildProps } from "../parallelBuilder/BuildImpl";
import DeployImpl, { DeploymentMode, DeployProps } from "../deploy/DeployImpl";
import ArtifactGenerator from "@dxatscale/sfpowerscripts.core/lib/generators/ArtifactGenerator";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import { Stage } from "../Stage";
import SFPLogger, { LoggerLevel } from "@dxatscale/sfpowerscripts.core/lib/utils/SFPLogger";
import fs = require("fs");
const Table = require("cli-table");

export enum ValidateMode {
  ORG,
  POOL
}

export default class ValidateImpl {

  constructor (
    private devHubUsername: string,
    private pools: string[],
    private jwt_key_file: string,
    private client_id: string,
    private shapeFile: string,
    private coverageThreshold: number,
    private logsGroupSymbol: string[],
    private isDeleteScratchOrg: boolean,
    private validateMode: ValidateMode,
    private configFilePath?: string
  ){}

  public async exec(): Promise<boolean>{
    let scratchOrgUsername: string;
    try {
      this.authenticateDevHub(this.devHubUsername);

      let packagesToCommits: {[p: string]: string} = {};

      if (this.validateMode === ValidateMode.ORG) {
        scratchOrgUsername = this.createScratchOrg(this.configFilePath, this.devHubUsername);

        this.installPackageDependencies(scratchOrgUsername, this.devHubUsername);
      } else if (this.validateMode === ValidateMode.POOL) {
        scratchOrgUsername = this.fetchScratchOrgFromPool(
          this.pools,
          this.devHubUsername
        );

        this.authenticateToScratchOrg(scratchOrgUsername);

        let queryResult = this.querySfpowerscriptsArtifactsInScratchOrg(scratchOrgUsername);
        if (queryResult) {
          if (queryResult.status === 0) {
            packagesToCommits = this.getPackagesToCommits(queryResult);
            this.printArtifactVersions(queryResult);
          } else console.log("Failed to query org for Sfpowerscripts Artifacts");
        }

      } else throw new Error(`Unknown mode ${this.validateMode}`);


      if (this.shapeFile) {
        this.deployShapeFile(this.shapeFile, scratchOrgUsername);
      }


      await this.buildChangedSourcePackages(packagesToCommits);

      // Un-suppress logs for deployment
      SFPLogger.isSupressLogs = false;
      SFPLogger.logLevel = LoggerLevel.INFO;

      let deploymentResult = await this.deploySourcePackages(scratchOrgUsername);

      if (deploymentResult.failed.length > 0)
        return false;
      else
        return true;
    } finally {
      if (this.isDeleteScratchOrg) {
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

  private installPackageDependencies(scratchOrgUsername: string, devHubUsername: string): void {
    child_process.execSync(
      `sfdx sfpowerkit:package:dependencies:install -u ${scratchOrgUsername} -v ${devHubUsername} --noprompt -w 120`,
      {
        "stdio": 'inherit',
        "encoding": 'utf8'
      }
    );
  }

  private deleteScratchOrg(scratchOrgUsername: string): void {
    try {
      if (scratchOrgUsername && this.devHubUsername ) {
          console.log(`Deleting scratch org`, scratchOrgUsername);
          child_process.execSync(
            `sfdx force:org:delete -p -u ${scratchOrgUsername} -v ${this.devHubUsername}`,
            {
              stdio: 'inherit',
              encoding: 'utf8'
            }
          );
      }
    } catch (error) {
      console.log(error.message);
    }
  }

  private authenticateDevHub(devHubUsername: string): void {
    child_process.execSync(
      `sfdx force:auth:jwt:grant -u ${devHubUsername} -i ${this.client_id} -f ${this.jwt_key_file} -r https://login.salesforce.com`,
      {
        stdio: "inherit",
        encoding: "utf8"
      }
    );
  }

  private deployShapeFile(shapeFile: string, scratchOrgUsername: string): void {
    console.log(`Deploying scratch org shape`, shapeFile);
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
    skipped: string[],
    failed: string[],
    testFailure: string
  }> {
    let deployStartTime: number = Date.now();

    let deployProps: DeployProps = {
       targetUsername : scratchOrgUsername,
       artifactDir : "artifacts",
       waitTime:120,
       deploymentMode:DeploymentMode.SOURCEPACKAGES,
       isTestsToBeTriggered:true,
       skipIfPackageInstalled:false,
       isValidateArtifactsOnHead:false,
       coverageThreshold:this.coverageThreshold,
       logsGroupSymbol:this.logsGroupSymbol,
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

  private async buildChangedSourcePackages(packagesToCommits: { [p: string]: string; }): Promise<void> {
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
          `Unable to create artifact for ${generatedPackage.package_name}`
        );
        throw error;
      }
    }
    let buildElapsedTime: number = Date.now() - buildStartTime;

    this.printBuildSummary(generatedPackages, failedPackages, buildElapsedTime);
  }

  private getPackagesToCommits(queryResult: any): {[p: string]: string} {
    let packagesToCommits: {[p: string]: string} = {};

    // Construct map of artifact and associated commit Id
    queryResult.result.records.forEach((artifact) => {
      packagesToCommits[artifact.Name] = artifact.CommitId__c;
    });

    return packagesToCommits;
  }

  private printArtifactVersions(queryResult: any) {
    let table = new Table({
      head: ["Artifact", "Version"],
    });

    queryResult.result.records.forEach((artifact) => {
      table.push([artifact.Name, artifact.Version__c]);
    });

    console.log(`Artifacts installed in scratch org:`);
    console.log(table.toString());
  }

  /**
   * Query SfpowerscriptsArtifact__c records in scratch org. Returns query result as JSON if records are found,
   * otherwise returns null.
   * @param scratchOrgUsername
   */
  private querySfpowerscriptsArtifactsInScratchOrg(scratchOrgUsername): any {
    let queryResultJson: string;
    try {
      console.log("Querying scratch org for Sfpowerscripts Artifacts");
      queryResultJson = child_process.execSync(
        `sfdx force:data:soql:query -q "SELECT Id, Name, CommitId__c, Version__c, Tag__c FROM SfpowerscriptsArtifact__c" -r json -u ${scratchOrgUsername}`,
        {
          stdio: "pipe",
          encoding: "utf8"
        }
      );
    } catch (error) {}

    if (queryResultJson) {
      return JSON.parse(queryResultJson);
    } else
      console.log("Failed to query org for Sfpowerscripts Artifacts");
      return null;
  }

  private authenticateToScratchOrg(scratchOrgUsername: string): void {
    child_process.execSync(
      `sfdx force:auth:jwt:grant -u ${scratchOrgUsername} -i ${this.client_id} -f ${this.jwt_key_file} -r https://test.salesforce.com`,
      {
        stdio: ['ignore', 'inherit', 'inherit']
      }
    );
  }

  private fetchScratchOrgFromPool(pools: string[], devHubUsername: string): string {
    let scratchOrgUsername: string;

    for (let pool of pools) {
      let fetchResultJson: string;
      try {
        fetchResultJson = child_process.execSync(
          `sfdx sfpowerkit:pool:fetch -t ${pool.trim()} -v ${devHubUsername} --json`,
          {
            stdio: 'pipe',
            encoding: 'utf8'
          }
        );
      } catch (error) {}

      if (fetchResultJson) {
        let fetchResult = JSON.parse(fetchResultJson);
        if (fetchResult.status === 0) {
          scratchOrgUsername = fetchResult.result.username;
          console.log(`Fetched scratch org ${scratchOrgUsername} from ${pool}`);
          break;
        }
      }
    }

    if (scratchOrgUsername)
      return scratchOrgUsername;
    else
      throw new Error(`Failed to fetch scratch org from ${pools}`);
  }

  private createScratchOrg(configFilePath: string, devHubUsername: string): string {
    let createResultJson: string = child_process.execSync(
      `sfdx force:org:create -f ${configFilePath} -v ${devHubUsername} -d 1 --json`,
      {
        stdio: 'pipe',
        encoding: 'utf8'
      }
    );

    let createResult = JSON.parse(createResultJson);
    if (createResult.status === 0) {
      console.log(`Created scratch org`, createResult.result.username);
      return createResult.result.username;
    } else throw new Error(`Failed to create scratch org: ${createResult.message}`);
  }

  private printBuildSummary(
    generatedPackages: PackageMetadata[],
    failedPackages: string[],
    totalElapsedTime: number
  ): void {
    console.log(
      `----------------------------------------------------------------------------------------------------`
    );
    console.log(
      `${
        generatedPackages.length
      } packages created in ${new Date(totalElapsedTime).toISOString().substr(11,8)
      } with {${failedPackages.length}} errors`
    );



    if (failedPackages.length > 0) {
      console.log(`Packages Failed To Build`, failedPackages);
    }
    console.log(
      `----------------------------------------------------------------------------------------------------`
    );
  }

  private printDeploySummary(
    deploymentResult: {deployed: string[], skipped: string[], failed: string[], testFailure: string},
    totalElapsedTime: number
  ): void {
    if (this.logsGroupSymbol?.[0])
      console.log(this.logsGroupSymbol[0], "Deployment Summary");

    console.log(
      `----------------------------------------------------------------------------------------------------`
    );
    console.log(
      `${deploymentResult.deployed.length} packages deployed in ${new Date(totalElapsedTime).toISOString().substr(11,8)
      } with {${deploymentResult.failed.length}} failed deployments and {${deploymentResult.skipped.length}} skipped`
    );

    if (deploymentResult.testFailure)
      console.log(`\nTests failed for`, deploymentResult.testFailure);

    if (deploymentResult.skipped.length > 0) {
      console.log(`\nPackages Skipped`, deploymentResult.skipped);
    }

    if (deploymentResult.failed.length > 0) {
      console.log(`\nPackages Failed to Deploy`, deploymentResult.failed);
    }
    console.log(
      `----------------------------------------------------------------------------------------------------`
    );
  }
}
