import child_process = require("child_process");

export default class ValidateApexCoverageImpl {
  public constructor(private target_org: string, private required_coverage: number) {}

  public async exec(command: string): Promise<void> {
    let result = child_process.execSync(command, {
      encoding: "utf8"

    });

    let resultAsJSON = JSON.parse(result);

    if( Number(resultAsJSON.result.coverage) < this.required_coverage)
     throw new Error(`Org Coverage is currently at ${resultAsJSON.result.coverage}, which is less than the required coverage ${ this.required_coverage} `);

    console.log(`Org Coverage is currently at ${resultAsJSON.result.coverage}`);
  }

  public async buildExecCommand(): Promise<string> {
    let command = `npx sfdx sfpowerkit:org:orgcoverage -u  ${this.target_org} --json`;

    return command;
  }


}
