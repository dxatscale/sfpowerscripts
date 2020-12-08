import child_process = require("child_process");
import BuildImpl from "../parallelBuilder/BuildImpl";
import DeployImpl from "../deploy/DeployImpl";
import ArtifactGenerator from "@dxatscale/sfpowerscripts.core/lib/generators/ArtifactGenerator";
import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";

export default class ValidateImpl {

  constructor (
    private devhub_alias: string,
    private pools: string[],
    private jwt_key_file: string,
    private client_id: string,
    private shapeFile: string,
    private coverageThreshold: number
  ){}

  public async exec(): Promise<boolean>{

    let targetusername: string = this.fetchScratchOrgFromPool(
      this.pools,
      this.devhub_alias
    );

    this.authenticateToScratchOrg(targetusername);

    let packagesToTags = this.getPackagesToTags();

    await this.buildChangedSourcePackages(packagesToTags);


    let deploymentResult = await this.deploySourcePackages();

    if (deploymentResult.failed.length > 0)
      return false;
    else
      return true;
  }

  private async deploySourcePackages() {
    let deployStartTime: number = Date.now();

    let deployImpl: DeployImpl = new DeployImpl(
      "scratchorg",
      "artifacts",
      "120",
      null,
      null,
      true,
      false,
      this.coverageThreshold
    );

    let deploymentResult = await deployImpl.exec();

    let deploymentElapsedTime: number = Date.now() - deployStartTime;
    this.printDeploySummary(deploymentResult, deploymentElapsedTime);

    return deploymentResult;
  }

  private async buildChangedSourcePackages(packagesToTags: { [p: string]: string; }) {
    let buildStartTime: number = Date.now();


    let buildImpl: BuildImpl = new BuildImpl(
      null,
      null,
      null,
      null,
      null,
      null,
      true,
      1,
      10,
      true,
      null,
      packagesToTags
    );

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

  private getPackagesToTags(): {[p: string]: string} {
    let packagesToTags: {[p: string]: string} = {};

    let queryResult = this.querySfpowerscriptsArtifacts();

    if (queryResult) {
      if (queryResult.status === 0) {
        // Construct map of artifact and associated latest tag
        queryResult.result.records.forEach((artifact) => {
          packagesToTags[artifact.Name] = artifact.Tag__c;
        });

        console.log(`Artifacts installed in scratch org: ${JSON.stringify(packagesToTags, null, 4)}`);
      }
      else
        console.log("Failed to query org for Sfpowerscripts Artifacts");
    }

    return packagesToTags;
  }

  private querySfpowerscriptsArtifacts(): any {
    let queryResultJson: string;
    try {
      console.log("Querying scratch org for Sfpowerscripts Artifacts");
      queryResultJson = child_process.execSync(
        `sfdx force:data:soql:query -q "SELECT Id, Name, CommitId__c, Version__c, Tag__c FROM SfpowerscriptsArtifact__c" -r json -u scratchorg`,
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

  private authenticateToScratchOrg(targetusername: string): void {
    child_process.execSync(
      `sfdx force:auth:jwt:grant -u ${targetusername} -i ${this.client_id} -f ${this.jwt_key_file} -a scratchorg -r https://test.salesforce.com`,
      {
        stdio: ['ignore', 'inherit', 'inherit']
      }
    );
  }

  private fetchScratchOrgFromPool(pools: string[], devhub_alias: string): string {
    let targetusername: string;

    for (let pool of pools) {
      let fetchResultJson: string;
      try {
        fetchResultJson = child_process.execSync(
          `sfdx sfpowerkit:pool:fetch -t ${pool.trim()} -v ${devhub_alias} --json`,
          {
            stdio: 'pipe',
            encoding: 'utf8'
          }
        );
      } catch (error) {}

      if (fetchResultJson) {
        let fetchResult = JSON.parse(fetchResultJson);
        if (fetchResult.status === 0) {
          targetusername = fetchResult.result.username;
          console.log(`Fetched scratch org ${targetusername} from ${pool}`);
          break;
        }
      }
    }

    if (targetusername)
      return targetusername;
    else
      throw new Error(`Failed to fetch scratch org from ${pools}`);
  }

  private printBuildSummary(
    generatedPackages: PackageMetadata[],
    failedPackages: string[],
    totalElapsedTime: number
  ) {
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
  ) {
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
