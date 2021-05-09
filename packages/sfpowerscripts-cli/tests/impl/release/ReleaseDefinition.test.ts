import { jest, expect } from "@jest/globals";
import fs from "fs-extra";
import ReleaseDefinition from "../../../src/impl/release/ReleaseDefinition";

describe("Given a release definition, validateReleaseDefinition", () => {
  let releaseDefinitionYaml: string;

  beforeEach( () => {
    const fsMock = jest.spyOn(fs, "readFileSync");
    fsMock.mockImplementation( () => {
      return releaseDefinitionYaml;
    });
  });

  it("should throw if artifacts field is missing", () => {
    releaseDefinitionYaml = `
      release: "test-release"
    `;

    expect(() => { new ReleaseDefinition(null); }).toThrow();
  });

  it("should throw if release field is missing", () => {
    releaseDefinitionYaml = `
      artifacts:
        packageA: "1.0.0-0"
    `;

    expect(() => { new ReleaseDefinition(null); }).toThrow();
  });

  it("should not throw an error for valid package dependency", () => {
    releaseDefinitionYaml = `
      release: "test-release"
      artifacts:
        packageA: "3.0.5-13"
      packageDependencies:
        packageX: 04t0H000000xVrwQAE
    `;

    expect(() => { new ReleaseDefinition(null); }).not.toThrow();
  });

  it("should throw an error for an invalid package dependency", () => {
    releaseDefinitionYaml = `
      release: "test-release"
      artifacts:
        packageA: "3.0.5-13"
      packageDependencies:
        packageX: 04t0H000000xVrwQAE123
    `;

    expect(() => { new ReleaseDefinition(null); }).toThrow();
  });

  it("should not throw an error for valid release parameters", () => {
    releaseDefinitionYaml = `
      release: "test-release"
      skipIfAlreadyInstalled: true
      baselineOrg: "prod"
      artifacts:
        packageA: "3.0.5-13"
    `;

    expect(() => { new ReleaseDefinition(null); }).not.toThrow();
  });

  it("should throw an error if baselineOrg specified but skipIfAlreadyInstalled is false", () => {
    releaseDefinitionYaml = `
      release: "test-release"
      skipIfAlreadyInstalled: false
      baselineOrg: "prod"
      artifacts:
        packageA: "3.0.5-13"
    `;

    expect(() => { new ReleaseDefinition(null); }).toThrow();
  });

  it("should not throw an error for valid changelog parameters", () => {
    releaseDefinitionYaml = `
      release: "test-release"
      artifacts:
        packageA: "3.0.5-13"
      changelog:
        workItemFilter: "GOR-[0-9]{4}"
        workItemUrl: "https://www.atlassian.com/software/jira"
        limit: 10
        showAllArtifacts: false
    `;

    expect(() => { new ReleaseDefinition(null); }).not.toThrow();
  });

  it("should throw an error if required changelog parameters are missing", () => {
    releaseDefinitionYaml = `
      release: "test-release"
      artifacts:
        packageA: "3.0.5-13"
      changelog:
        workItemUrl: "https://www.atlassian.com/software/jira"
        limit: 10
        showAllArtifacts: false
    `;

    expect(() => { new ReleaseDefinition(null); }).toThrow();
  });
});
