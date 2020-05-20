import child_process = require("child_process");
import { onExit } from "../OnExit";

export default class PromoteUnlockedPackageImpl {
  public constructor(private  working_directory:string,private package_version_id: string, private devhub_alias: string) {}

  public async exec(): Promise<void> {
    let command = await this.buildExecCommand();

    console.log(`Triggering Command: ${command}`)

    let child = child_process.exec(command, { cwd: this.working_directory, encoding: "utf8" },(error, stdout, stderr) => {
      if (error) throw error;
    });

    child.stdout.on("data", data => {
      console.log(data.toString());
    });

    await onExit(child);
  }

  public async buildExecCommand(): Promise<string> {
    let command = `npx sfdx force:package:version:promote -v ${this.devhub_alias}`;
    //package
    command += ` -p ${this.package_version_id}`;
    //noprompt
    command += ` -n`;

    return command;
  }
}
