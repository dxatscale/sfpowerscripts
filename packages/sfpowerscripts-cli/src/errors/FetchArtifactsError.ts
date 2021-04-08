import SfpowerscriptsError from "./SfpowerscriptsError";

export default class FetchArtifactsError extends SfpowerscriptsError {

  /**
   * Payload consisting of artifacts that succeeded and failed to fetch
   */
  readonly data: {
    success: [string, string][],
    failed: [string, string][]
  }

  constructor(
    message: string,
    data: {success: [string, string][], failed: [string,string][]}
  ) {
    super(message);

    this.data = data;
  }
}
