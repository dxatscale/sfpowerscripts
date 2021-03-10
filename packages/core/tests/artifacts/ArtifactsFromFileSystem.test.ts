import { jest,expect } from "@jest/globals";
const glob = require("glob");
import ArtifactFilePathFetcher from "../../src/artifacts/ArtifactFilePathFetcher";

describe("Provided a path to the artifacts folder containing sfpowerscripts artifact", () => {



  it("should return all the artifacts, if a package name is not provided", () => {
    const globMock = jest.spyOn(glob, "sync");
    globMock.mockImplementation(() => {
      return new Array(
        "/path/to/core_sfpowerscripts_artifact_1.0.0-2.zip",
        "/path/to/core2_sfpowerscripts_artifact_1.0.0-2.zip",
        "/path/to/core3_sfpowerscripts_artifact_1.0.0-3.zip",
        "/path/to/my-package_sfpowerscripts_artifact_3.30.53-NEXT.tgz"
      );
    });
    let artifacts = ArtifactFilePathFetcher.findArtifacts("artifacts");
    expect(artifacts).toEqual(
      new Array(
        "/path/to/core_sfpowerscripts_artifact_1.0.0-2.zip",
        "/path/to/core2_sfpowerscripts_artifact_1.0.0-2.zip",
        "/path/to/core3_sfpowerscripts_artifact_1.0.0-3.zip",
        "/path/to/my-package_sfpowerscripts_artifact_3.30.53-NEXT.tgz"
      )
    );

  });

  it("provided only one artifact exists for a package and a package name is provided, it should just return the one artifact", () => {
    const globMock = jest.spyOn(glob, "sync");
    globMock.mockImplementation(() => {
      return new Array(
        "/path/to/core_sfpowerscripts_artifact_1.0.0-2.zip"
      );
    });
    let artifacts = ArtifactFilePathFetcher.findArtifacts("artifacts","core");
    expect(artifacts).toEqual(
      new Array(
        "/path/to/core_sfpowerscripts_artifact_1.0.0-2.zip"
      )
    );
  });

  it("provided multiple artifacts of the same package exists and a package name is provied, it should return the latest", () => {
    const globMock = jest.spyOn(glob, "sync");
    globMock.mockImplementation(() => {
      return new Array(
        "/path/to/core_sfpowerscripts_artifact_1.0.0-2.zip",
        "/path/to/core_sfpowerscripts_artifact_1.0.0-3.zip",
        "/path/to/core_sfpowerscripts_artifact_1.0.0-4.zip",
        "/path/to/core_sfpowerscripts_artifact_1.0.0-5.tgz"
      );
    });
    let artifacts = ArtifactFilePathFetcher.findArtifacts("artifacts","core");
    expect(artifacts).toEqual(
      new Array(
        "/path/to/core_sfpowerscripts_artifact_1.0.0-5.tgz"
      )
    );
  });





});
