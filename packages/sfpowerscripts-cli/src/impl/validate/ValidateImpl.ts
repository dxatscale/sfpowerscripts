import child_process = require("child_process");
import BuildImpl, { BuildProps } from "../parallelBuilder/BuildImpl";
import DeployImpl, { DeploymentMode } from "../deploy/DeployImpl";
import ArtifactGenerator from "@dxatscale/sfpowerscripts.core/lib/generators/ArtifactGenerator";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import { Stage } from "../Stage";
import SFPLogger, { LoggerLevel } from "@dxatscale/sfpowerscripts.core/lib/utils/SFPLogger";


export default class ValidateImpl {

  constructor (
    private devHubUsername: string,
    private pools: string[],
    private jwt_key_file: string,
    private client_id: string,
    private shapeFile: string,
    private coverageThreshold: number,
    private logsGroupSymbol: string[],
    private isDeleteScratchOrg: boolean
  ){}

  public async exec(): Promise<boolean>{
    let scratchOrgUsername: string;
    try {
     this.authenticateDevHub(this.devHubUsername);

      scratchOrgUsername = this.fetchScratchOrgFromPool(
        this.pools,
        this.devHubUsername
      );

      this.authenticateToScratchOrg(scratchOrgUsername);

  

      if (this.shapeFile) {
        this.deployShapeFile(this.shapeFile, scratchOrgUsername);
      }

      let packagesToCommits = this.getPackagesToCommits(scratchOrgUsername);

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
        console.log(`Deleting scratch org`, scratchOrgUsername);
        this.deleteScratchOrg(scratchOrgUsername);
      }
    }

  }

  private deleteScratchOrg(scratchOrgUsername: string): void {
    child_process.execSync(
      `sfdx force:org:delete -p -u ${scratchOrgUsername} -v ${this.devHubUsername}`,
      {
        stdio: 'inherit',
        encoding: 'utf8'
      }
    );
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
    failed: string[]
  }> {
    let deployStartTime: number = Date.now();

    let deployImpl: DeployImpl = new DeployImpl(
      scratchOrgUsername,
      "artifacts",
      "120",
      Stage.VALIDATE,
      null
    );

    deployImpl.setDeploymentMode(DeploymentMode.SOURCEPACKAGES);
    deployImpl.activateApexUnitTests(true);
    deployImpl.skipIfPackageExistsInTheOrg(false);
    deployImpl.setCoverageThreshold(this.coverageThreshold);
    deployImpl.setLogSymbols(this.logsGroupSymbol);

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
       packagesToCommits:packagesToCommits
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

  private getPackagesToCommits(scratchOrgUsername: string): {[p: string]: string} {
    let packagesToCommits: {[p: string]: string} = {};

    let queryResult = this.querySfpowerscriptsArtifactsInScratchOrg(scratchOrgUsername);

    if (queryResult) {
      if (queryResult.status === 0) {
        // Construct map of artifact and associated latest tag
        queryResult.result.records.forEach((artifact) => {
          packagesToCommits[artifact.Name] = artifact.CommitId__c;
        });

        console.log(`Artifacts installed in scratch org: ${JSON.stringify(packagesToCommits, null, 4)}`);
      }
      else
        console.log("Failed to query org for Sfpowerscripts Artifacts");
    }

    return packagesToCommits;
  }

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
    deploymentResult: {deployed: string[], skipped: string[], failed: string[]},
    totalElapsedTime: number
  ): void {
    if (this.logsGroupSymbol?.[0])
      console.log(this.logsGroupSymbol[0], "Deployment Summary");

    console.log(
      `----------------------------------------------------------------------------------------------------`
    );
    console.log(
      `${deploymentResult.deployed.length} packages deployed in ${new Date(totalElapsedTime).toISOString().substr(11,8)
      } with {${deploymentResult.failed.length}} errors and {${deploymentResult.skipped.length}} skipped`
    );


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
