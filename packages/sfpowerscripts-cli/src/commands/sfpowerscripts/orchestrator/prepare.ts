import { Messages, SfdxError } from "@salesforce/core";
import SfpowerscriptsCommand from "../../../SfpowerscriptsCommand";
import { flags } from "@salesforce/command";
import PrepareImpl from "../../../impl/prepare/PrepareImpl";
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender";
import { Stage } from "../../../impl/Stage";
import * as fs from "fs-extra"
import ScratchOrgInfoFetcher from "../../../impl/pool/services/fetchers/ScratchOrgInfoFetcher";
import path from "path";
import Ajv from "ajv"


Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages("@dxatscale/sfpowerscripts", "prepare");

export default class Prepare extends SfpowerscriptsCommand {
  protected static requiresDevhubUsername = true;
  protected static requiresProject = true;

  protected static flagsConfig = {
    poolconfig: flags.filepath({
      required: false,
      default: "config/cipoolconfig.json",
      char: "f",
      description: messages.getMessage("configDescription"),
    }),
  };

  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerscripts:orchestrator:prepare -t CI_1  -v <devhub>`,
  ];



  public async execute(): Promise<any> {


    let executionStartTime = Date.now();

    console.log("-----------sfpowerscripts orchestrator ------------------");
    console.log("command: prepare");

   //Read pool config
   try {
   let poolConfig = fs.readJSONSync(this.flags.poolconfig);
   this.validatePoolConfig(poolConfig);


    console.log(`Pool Name: ${poolConfig.tag}`);
    console.log(`Type of Pool: ${poolConfig.cipool?"ci":"dev"}`);
    console.log(`Requested Count of Orgs: ${poolConfig.maxallocation}`);
    console.log(`Scratch Orgs to be submitted to pool in case of failures: ${poolConfig.succeedOnDeploymentErrors}`)
    
    if(poolConfig.cipool)
    {
    console.log(`All packages in the repo to be installed: ${poolConfig.cipool.installAll}`);
    if(poolConfig.fetchArtifacts)
    {
    console.log(`Script provided to fetch artifacts: ${poolConfig.fetchArtifacts.artifactfetchscript?'true':'false'}`);
    console.log(`Fetch artifacts from pre-authenticated NPM registry: ${poolConfig.fetchArtifacts.npm ? "true" : "false"}`);
    if(poolConfig.fetchArtifacts.npm?.npmtag)
      console.log(`Tag utilized to fetch from NPM registry: ${this.flags.npmtag}`);
    }
    }


    console.log("---------------------------------------------------------");

    let tags = {
      stage: Stage.PREPARE,
      poolName:this.flags.tag
    }

    await this.hubOrg.refreshAuth();
    const hubConn = this.hubOrg.getConnection();

    this.flags.apiversion =
      this.flags.apiversion || (await hubConn.retrieveMaxApiVersion());

     

    let prepareImpl = new PrepareImpl(
      this.hubOrg,
      poolConfig
    );

    

  


      let results= await prepareImpl.exec();

      let totalElapsedTime=Date.now()-executionStartTime;
      console.log(
        `-----------------------------------------------------------------------------------------------------------`
      );
      console.log(`Provisioned {${results.success}}  scratchorgs out of ${results.totalallocated} requested with ${results.failed} failed in ${this.getFormattedTime(totalElapsedTime)} `)
      console.log(
        `----------------------------------------------------------------------------------------------------------`
      );

      if(results.errorCode)
      {
        switch(results.errorCode)
        {
          case "Max_Capacity": process.exitCode=0;
                              break;
          case "No_Capacity" : process.exitCode=0;
                               break;
          case "Fields_Missing": process.exitCode=1;
                                break;
        }
      }
      else if(results.success==0)
      {
        SFPStatsSender.logGauge(
          "prepare.failedorgs",
          results.failed,
          tags
        );

        process.exitCode=1;
      }
      else
      {


      await this.getCurrentRemainingNumberOfOrgsInPoolAndReport();

      SFPStatsSender.logGauge(
          "prepare.succeededorgs",
          results.success,
          tags
        );
      }
      SFPStatsSender.logGauge(
        "prepare.duration",
        (Date.now() - executionStartTime),
        tags
      );

    } catch (err) {
      throw new SfdxError("Unable to execute command .. " + err);
    }
  }


  private async getCurrentRemainingNumberOfOrgsInPoolAndReport() {
    try
    {
    const results = await new ScratchOrgInfoFetcher(this.hubOrg).getScratchOrgsByTag(
      this.flags.tag,
      false,
      true
    )
    SFPStatsSender.logGauge("pool.remaining", results.records.length, { poolName: this.flags.tag });
    }
    catch(error)
    {
     //do nothing, we are not reporting anything if anything goes wrong here
    }
  }

  private getFormattedTime(milliseconds: number): string {
    let date = new Date(0);
    date.setSeconds(milliseconds / 1000); // specify value for SECONDS here
    let timeString = date.toISOString().substr(11, 8);
    return timeString;
  }



 public validatePoolConfig(poolConfig:any)
 {
  let resourcesDir = path.join(
    __dirname,
    "..",
    "resources",
    "schemas"
  );
   let ajv=new Ajv({allErrors: true});
   let schema = fs.readJSONSync(path.join(resourcesDir,`pooldefinition.schema.json`), {encoding:'UTF-8'})
   let validator = ajv.compile(schema);
   let isSchemaValid = validator(poolConfig);
   if(!isSchemaValid)
   {
    let errorMsg: string =`The pool configuration is invalid, Please fix the following errors\n`;

    validator.errors.forEach((error,errorNum) => {
      errorMsg += `\n${errorNum+1}: ${error.instancePath}: ${error.message} ${JSON.stringify(error.params, null, 4)}`;
    });

    throw new Error(errorMsg);
   }
 }


}
