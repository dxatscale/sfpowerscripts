import child_process = require("child_process");
import { isNullOrUndefined } from "util";
import { onExit } from "../OnExit";
const sfdx=require("../sfdx-node/LoadSFDX");


export default class InstallUnlockedPackageImpl {
  public constructor(
    private package_version_id: string,
    private targetusername: string,
    private options: any,
    private wait_time: string,
    private publish_wait_time: string,
    private skipIfAlreadyInstalled: boolean,
    private configDir:string
  ) {
    

  }

  public async exec(): Promise<void> {


   

    await sfdx.org.list({
      _quiet: false,
    });

    //get all packages in the org
    if(this.skipIfAlreadyInstalled)
    {
      
      // let packages=await sfdx.sfpowerkit.package.version.info(
      //   {
      //      targetusername:this.targetusername,
      //      quiet:true,
      //      json:true
      //   }
      // );
      //console.log(JSON.stringify(packages));
    }

   
    let command = await this.buildExecCommand();

    // let child = child_process.exec(command, (error, stdout, stderr) => {
    //   if (error) throw error;
    // });

    // child.stdout.on("data", (data) => {
    //   console.log(data.toString());
    // });

    // await onExit(child);
  }

  public async buildExecCommand(): Promise<string> {
    let command = `npx sfdx force:package:install --package ${this.package_version_id} -u ${this.targetusername} --noprompt`;

    command += ` --publishwait=${this.publish_wait_time}`;
    command += ` --wait=${this.wait_time}`;
    command += ` --securitytype=${this.options["securitytype"]}`;
    command += ` --upgradetype=${this.options["upgradetype"]}`;
    command += ` --apexcompile=${this.options["apexcompile"]}`;

    if (!isNullOrUndefined(this.options["installationkey"]))
      command += ` --installationkey=${this.options["installationkey"]}`;

    console.log(`Generated Command ${command}`);

    return command;
  }
}
