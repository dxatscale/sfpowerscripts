import { expect } from "@jest/globals";
import validateReleaseDefinition from "../../../src/impl/release/validateReleaseDefinition";
import ReleaseDefinition from "../../../src//impl/release/ReleaseDefinitionInterface";

describe("Given a release definition, validateReleaseDefinition", () => {

  it("should not throw an error for a valid non-NPM release definition", () => {
    let releaseDefinition: ReleaseDefinition = {
      release: "test-release",
      artifacts: {
        packageA: "3.0.5-13",
        packageC: "3.0.0",
        packageB: "LATEST_TAG"
      }
    }
    expect(() => {validateReleaseDefinition(releaseDefinition, false)}).not.toThrow();
  });

  it("should not throw an error for a valid NPM release definition", () => {
    let releaseDefinitionNpm: ReleaseDefinition = {
      release: "test-release",
      artifacts: {
        packageA: "3.0.5-13",
        packageB: "LATEST_TAG",
        packageC: "3.0.0",
        packageD: "alpha",
        PackageE: "ALPHA",
        PackageF: "Alpha2"
      }
    }
    expect(() => {validateReleaseDefinition(releaseDefinitionNpm, true)}).not.toThrow();
  });

  it("should throw an error for incorrect semantic version", () => {
    let releaseDefinition: ReleaseDefinition = {
      release: "test-release",
      artifacts: {
        packageA: "3.0.5.10",
      }
    };

    expect(() => {validateReleaseDefinition(releaseDefinition, false)}).toThrow();
    expect(() => {validateReleaseDefinition(releaseDefinition, true)}).toThrow();

    releaseDefinition.artifacts.packageA = "3.0";
    expect(() => {validateReleaseDefinition(releaseDefinition, false)}).toThrow();
    expect(() => {validateReleaseDefinition(releaseDefinition, true)}).toThrow();

    releaseDefinition.artifacts.packageA = "3.0,5-10";
    expect(() => {validateReleaseDefinition(releaseDefinition, false)}).toThrow();
    expect(() => {validateReleaseDefinition(releaseDefinition, true)}).toThrow();
  });

  it("should throw for incorrectly formatted LATEST_TAG", () => {
    let releaseDefinition: ReleaseDefinition = {
      release: "test-release",
      artifacts: {
        packageA: "latest_tag",
      }
    };

    expect(() => {validateReleaseDefinition(releaseDefinition, false)}).toThrow();
    expect(() => {validateReleaseDefinition(releaseDefinition, true)}).toThrow();

    releaseDefinition.artifacts.packageA = "latest-tag"
    expect(() => {validateReleaseDefinition(releaseDefinition, false)}).toThrow();
    expect(() => {validateReleaseDefinition(releaseDefinition, true)}).toThrow();

    releaseDefinition.artifacts.packageA = "LATEST-TAG"
    expect(() => {validateReleaseDefinition(releaseDefinition, false)}).toThrow();
    expect(() => {validateReleaseDefinition(releaseDefinition, true)}).toThrow();
  });

  it("should throw for NPM tags when not in NPM mode", () => {
    let releaseDefinition: ReleaseDefinition = {
      release: "test-release",
      artifacts: {
        packageA: "alpha"
      }
    }

    expect(() => {validateReleaseDefinition(releaseDefinition, false)}).toThrow();

    releaseDefinition.artifacts.packageA = "Beta2"
    expect(() => {validateReleaseDefinition(releaseDefinition, false)}).toThrow();
  });

  it("should throw if artifacts field is missing", () => {
    let releaseDefinition = {
      release: "test-release",
    } as ReleaseDefinition

    expect(() => {validateReleaseDefinition(releaseDefinition, false)}).toThrow();
  });

  it("should throw if release field is missing", () => {
    let releaseDefinition = {
      artifacts: {
        packageA: "1.0.0-0"
      }
    } as unknown as ReleaseDefinition

    expect(() => {validateReleaseDefinition(releaseDefinition, false)}).toThrow();
  });
});
