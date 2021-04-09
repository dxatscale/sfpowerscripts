import SfpowerscriptsError from "./SfpowerscriptsError";

export default class FetchArtifactsError extends SfpowerscriptsError {

  /**
   * Payload consisting of artifacts that succeeded and failed to fetch
   */
  readonly data: {
    success: [string, string][],
    failed: [string, string][]
  }

  /**
   * The underlying error that caused this error to be raised
   */
  readonly cause: Error

  constructor(
    message: string,
    data: {success: [string, string][], failed: [string,string][]},
    cause: Error
  ) {
    super(message);

    this.data = data;
    this.cause = cause;
  }
}
