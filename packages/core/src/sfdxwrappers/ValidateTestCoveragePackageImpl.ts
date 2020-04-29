import child_process = require("child_process");

export default class ValidateTestCoveragePackageImpl {


  public constructor(private target_org: string, private required_coverage: number, private package_version_id:string) {}

  public async exec(command: string): Promise<void> {
    let result = child_process.execSync(command, {
      encoding: "utf8"

    });

    let resultAsJSON = JSON.parse(result);

    console.log(resultAsJSON);

    if( Number(resultAsJSON.result.coverage) < this.required_coverage)
     throw new Error(`Package Code Coverage is currently at ${resultAsJSON.result.coverage}, which is less than the required coverage ${ this.required_coverage} `);

    console.log(`Package Code Coverage is currently at ${resultAsJSON.result.coverage}`);
  }

  public async buildExecCommand(): Promise<string> {
    let command = `npx sfdx sfpowerkit:package:version:codecoverage -u  ${this.target_org} -i ${this.package_version_id} --json`;

    return command;
  }


}
