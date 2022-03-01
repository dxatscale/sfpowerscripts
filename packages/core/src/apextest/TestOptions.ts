export class TestOptions {
  synchronous?: boolean;
  wait_time: number;
  outputdir: string;
  testLevel: TestLevel;
}

export class RunSpecifiedTestsOption extends TestOptions {

  specifiedTests: string;
  constructor(
    wait_time: number,
    outputdir: string,
    specifiedTests: string,
    synchronous?: boolean
  ) {
    super();
    this.synchronous = synchronous?synchronous:false;
    this.wait_time = wait_time?wait_time:60;
    this.outputdir = outputdir;
    this.specifiedTests = specifiedTests;
    this.testLevel=TestLevel.RunSpecifiedTests;
  }
}

export class RunApexTestSuitesOption extends TestOptions {
  suiteNames: string;
  constructor(
    wait_time: number,
    outputdir: string,
    suiteNames: string,
    pkg?: string,
    synchronous?: boolean
  ) {
    super();
    this.synchronous = synchronous?synchronous:false;
    this.wait_time = wait_time?wait_time:60;
    this.outputdir = outputdir;
    this.suiteNames = suiteNames;
    this.testLevel=TestLevel.RunApexTestSuite;
  }
}

export class RunLocalTests extends TestOptions {
  constructor(
    wait_time: number,
    outputdir: string,
    synchronous?: boolean
  ) {
    super();
    this.synchronous = synchronous?synchronous:false;
    this.wait_time = wait_time?wait_time:60;
    this.outputdir = outputdir;
    this.testLevel=TestLevel.RunLocalTests
  }
}

export class RunAllTestsInOrg extends TestOptions {
  constructor(
    wait_time: number,
    outputdir: string,
    synchronous?: boolean
  ) {
    super();
    this.synchronous = synchronous?synchronous:false;
    this.wait_time = wait_time?wait_time:60;
    this.outputdir = outputdir;
    this.testLevel=TestLevel.RunAllTestsInOrg
  }
}

export enum TestLevel {
  RunSpecifiedTests = "RunSpecifiedTests",
  RunApexTestSuite = "RunApexTestSuite",
  RunLocalTests = "RunLocalTests",
  RunAllTestsInOrg = "RunAllTestsInOrg"
}
