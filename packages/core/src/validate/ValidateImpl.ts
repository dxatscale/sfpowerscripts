import child_process = require("child_process");
import BuildImpl from "../parallelBuilder/BuildImpl";
import DeployImpl from "../deploy/DeployImpl";

export default class ValidateImpl {

  constructor (
    private devhub_alias: string,
    private pools: string[],
    private jwt_key_file: string,
    private client_id: string,
    private shapeFile: string
  ){}

  public async exec(): Promise<void>{

    let targetusername: string;
    for (let pool of this.pools) {
      let fetchResultJson: string;
      try {
        fetchResultJson = child_process.execSync(
          `sfdx sfpowerkit:pool:fetch -t ${pool.trim()} -v ${this.devhub_alias} --json`,
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
          break;
        }
      }
    }

    if (targetusername) {
      child_process.execSync(
        `sfdx force:auth:jwt:grant -u ${targetusername} -i ${this.client_id} -f ${this.jwt_key_file} -a scratchorg -r https://test.salesforce.com`,
        {
          stdio: ['ignore', 'inherit', 'inherit']
        }
      )
    } else
      throw new Error(`Failed to fetch scratch org from ${this.pools}`);

    let queryResultJson: string;
    try {
      queryResultJson = child_process.execSync(
        `sfdx force:data:soql:query -q "SELECT Id, Name, CommitId__c, Version__c, Tag__c FROM SfpowerscriptsArtifact__c" -r json -u scratchorg`,
        {
          stdio: "pipe",
          encoding: "utf8"
        }
      );
    } catch (error) {}

    let packagesToTags: {[p: string]: string} = {};
    if (queryResultJson) {
      let queryResult = JSON.parse(queryResultJson);
      if (queryResult.status === 0) {
        // Construct map of artifact and associated latest tag
        queryResult.result.records.forEach( (artifact) => {
          packagesToTags[artifact.Name] = artifact.Tag__c
        });
      }
    }

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
    let buildResult = await buildImpl.exec();

    if (buildResult.failedPackages.length > 0)
      throw new Error(`Failed to create source packages ${buildResult.failedPackages}`);
  }

  // let deployImpl: DeployImpl = new DeployImpl(
  //   "scratchorg",

  // )
}
