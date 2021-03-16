import child_process = require("child_process");
import { onExit } from "../utils/OnExit";
import { isNullOrUndefined } from "util";
import SFPLogger from "../utils/SFPLogger";


export default class AnalyzeWithPMDImpl {


  public constructor(private project_directory:string, private directory: string, private ruleset:string, private format:string, private ouputPath: string, private version:string) {}

  public async exec(command: string): Promise<void> {

    let child=child_process.exec(command,  { encoding: "utf8",maxBuffer: 1024 * 1024*5, cwd:this.project_directory });

    child.stdout.on("data",data=>{SFPLogger.log(data.toString()); });
    child.stderr.on("data",data=>{SFPLogger.log(data.toString()); });


    await onExit(child);

  }

  public async buildExecCommand(): Promise<string> {

    let command;
        command = `sfdx sfpowerkit:source:pmd`;


    if(!isNullOrUndefined(this.directory))
    command+=` -d  ${this.directory}`;


    if(!isNullOrUndefined(this.format))
    command+=` -f  ${this.format}`;

    if(!isNullOrUndefined(this.ouputPath))
    command+=` -o  ${this.ouputPath}`;

    if(!isNullOrUndefined(this.ruleset) && this.ruleset.length>0)
    command+=` -r  ${this.ruleset}`;

    if(!isNullOrUndefined(this.version))
    command+=` --version=${this.version}`;

    command+=` --loglevel INFO`

    SFPLogger.log(command);
    return command;
  }


}
