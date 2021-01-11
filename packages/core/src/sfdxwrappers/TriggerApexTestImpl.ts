import { SFDXCommand } from "../SFDXCommand";

export default class TriggerApexTestImpl extends SFDXCommand {
  public constructor(
    target_org: string,
    project_directory: string,
    private testOptions: TestOptions
  ) {
    super(target_org, project_directory);
  }

  getCommandName(): string {
    return "TriggerApexTest";
  }

  getGeneratedSFDXCommandWithParams(): string {
    let command;

    command = `sfdx force:apex:test:run -u ${this.target_org}`;

    if (this.testOptions.synchronous) command += " --synchronous";

    command += ` --wait=${this.testOptions.wait_time}`;
    command += ` --resultformat=json`;
    command += ` --codecoverage`;
    command += ` --outputdir=${this.testOptions.outputdir} `;

    if (this.testOptions instanceof RunSpecifiedTestsOption)
      command += this.buildCommandForSpecifiedTests(this.testOptions);
    else if (this.testOptions instanceof RunApexTestSuitesOption)
      command += this.buildCommandForApexTestSuite(this.testOptions);
    else if (this.testOptions instanceof RunLocalTests)
      command += this.buildCommandForLocalTestInOrg();
    else if (this.testOptions instanceof RunAllTestsInOrg)
      command += this.buildCommandForAllTestInOrg();

    return command;
  }

  buildCommandForApexTestSuite(testOptions: RunApexTestSuitesOption) {
    return `--testlevel=RunSpecifiedTests --suitenames=${testOptions.suiteNames}`;
  }

  private buildCommandForSpecifiedTests(
    testOptions: RunSpecifiedTestsOption
  ): string {
    return `--testlevel=RunSpecifiedTests --classnames=${testOptions.specifiedTests}`;
  }
  private buildCommandForLocalTestInOrg(): string {
    return `--testlevel=RunLocalTests`;
  }
  private buildCommandForAllTestInOrg(): string {
    return `--testlevel=RunAllTestsInOrg`;
  }

  async executeCommand() {
    await super.exec(true);
  }
}

export interface TestOptions {
  pkg?: string;
  synchronous?: boolean;
  wait_time: number;
  outputdir: string;
  testLevel: TestLevel;
}

export class RunSpecifiedTestsOption implements TestOptions {
  pkg?: string;
  validateIndividualClassCoverage?: boolean = false;
  synchronous?: boolean = false;
  wait_time: number = 60;
  outputdir: string;
  testLevel: TestLevel.RunSpecifiedTests;
  specifiedTests: string;
  constructor(
    wait_time: number,
    outputdir: string,
    specifiedTests: string,
    pkg?: string,
    synchronous?: boolean
  ) {
    this.pkg = pkg;
    this.synchronous = synchronous;
    this.wait_time = wait_time;
    this.outputdir = outputdir;
    this.specifiedTests = specifiedTests;
  }
}

export class RunApexTestSuitesOption implements TestOptions {
  pkg?: string;
  synchronous?: boolean = false;
  wait_time: number = 60;
  outputdir: string;
  testLevel: TestLevel.RunSpecifiedTests;
  suiteNames: string;
  constructor(
    wait_time: number,
    outputdir: string,
    suiteNames: string,
    pkg?: string,
    synchronous?: boolean
  ) {
    this.pkg = pkg;
    this.synchronous = synchronous;
    this.wait_time = wait_time;
    this.outputdir = outputdir;
    this.suiteNames = suiteNames;
  }
}

export class RunLocalTests implements TestOptions {
  synchronous?: boolean = false;
  wait_time: number = 60;
  outputdir: string;
  testLevel: TestLevel.RunLocalTests;
  suiteNames: string;
  constructor(
    wait_time: number,
    outputdir: string,
    synchronous?: boolean
  ) {
    this.synchronous = synchronous;
    this.wait_time = wait_time;
    this.outputdir = outputdir;
  }
}

export class RunAllTestsInOrg implements TestOptions {
  synchronous?: boolean = false;
  wait_time: number = 60;
  outputdir: string;
  testLevel: TestLevel.RunAllTestsInOrg;
  suiteNames: string;
  constructor(
    wait_time: number,
    outputdir: string,
    synchronous?: boolean
  ) {
    this.synchronous = synchronous;
    this.wait_time = wait_time;
    this.outputdir = outputdir;
  }
}

export enum TestLevel {
  RunSpecifiedTests = "RunSpecifiedTests",
  RunApexTestSuite = "RunApexTestSuite",
  RunLocalTests = "RunLocalTests",
  RunAllTestsInOrg = "RunAllTestsInOrg",
  RunAllTestsInPackage = "RunAllTestsInPackage",
}
