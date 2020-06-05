import child_process = require("child_process");
import { isNullOrUndefined } from "util";
import { onExit } from "../OnExit";

export default class CreateUnlockedPackageImpl {
  public constructor(
    private sfdx_package: string,
    private version_number: string,
    private tag: string,
    private config_file_path: string,
    private installationkeybypass: boolean,
    private installationkey: string,
    private project_directory: string,
    private devhub_alias: string,
    private wait_time: string,
    private isCoverageEnabled: boolean,
    private isSkipValidation: boolean
  ) {}


  
  public async exec(command: string): Promise<{packageVersionId:string,versionNumber:string, testCoverage:number,hasPassedCoverageCheck:boolean}> {
    
    let child=child_process.exec(command,  {cwd:this.project_directory, encoding: "utf8" },(error,stdout,stderr)=>{
      if(error)
         throw error;
    });
   
    let output="";
    child.stdout.on("data",data=>{console.log(  data.toString()); 
      output+=data.toString();
    });

    await onExit(child);
    let subscriberPackageVersionId = JSON.parse(output).result.SubscriberPackageVersionId;

    //Get the full details on the package
    console.log("Fetching Version Number and Coverage details")
    let result = child_process.execSync(this.buildInfoCommand(subscriberPackageVersionId), {
      cwd: this.project_directory,
      encoding: "utf8",
    });

  console.log(result);

   let resultAsJSON = JSON.parse(result);
   let versionNumber = resultAsJSON.result[0].packageVersionNumber;
   let testCoverage = resultAsJSON.result[0].coverage;
   let hasPassedCoverageCheck =  resultAsJSON.result[0].HasPassedCodeCoverageCheck;

   return {packageVersionId:subscriberPackageVersionId,versionNumber:versionNumber,testCoverage:testCoverage,hasPassedCoverageCheck:hasPassedCoverageCheck}

  }

  public async buildExecCommand(): Promise<string> {
    let command = `npx sfdx force:package:version:create -p ${this.sfdx_package}  -w ${this.wait_time} --definitionfile ${this.config_file_path} --json`;

    if (!isNullOrUndefined(this.version_number))
      command += `  --versionnumber ${this.version_number}`;

    if (this.installationkeybypass) command += ` -x`;
    else command += ` -k ${this.installationkey}`;

    if (!isNullOrUndefined(this.tag)) command += ` -t ${this.tag}`;

    if (this.isCoverageEnabled) command += ` -c`;

    if (this.isSkipValidation) command += ` --skipvalidation`;

    command += ` -v ${this.devhub_alias}`;

    return command;
  }

  private buildInfoCommand(subscriberPackageVersion:string):string
  {
    let command = `npx sfdx sfpowerkit:package:version:codecoverage -i ${subscriberPackageVersion}  --json`;

    command += ` -v ${this.devhub_alias}`;

    return command;

  }
  
}
