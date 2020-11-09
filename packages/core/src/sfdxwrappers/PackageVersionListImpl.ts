import child_process = require("child_process");
import SFPLogger from "../utils/SFPLogger";
import { onExit } from "../utils/OnExit";

export default class PackageVersionListImpl {
  public constructor(private  project_directory:string,private devhub_alias: string) {}

  public async exec(): Promise<any> {

    let command = this.buildExecCommand();
    SFPLogger.log("Executing command",command);
    let child = child_process.exec(
      command,
      { cwd: this.project_directory, encoding: "utf8" }
    );

    child.stderr.on("data", data => {
      SFPLogger.log(data);
    });

    let output="";
    child.stdout.on("data", data => {
      output+=data;
    });

    await onExit(child);

    let result =  JSON.parse(output);
    if(result.status==0)
    {
    return result.result;
    }
    else
    {
      throw new Error("Unable to fetch Package Info");
    }


  }

  private  buildExecCommand(): string {
    let command = `npx sfdx force:package:list -v ${this.devhub_alias} --json`;

    return command;
  }
}
