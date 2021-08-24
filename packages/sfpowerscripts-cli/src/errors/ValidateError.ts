import SfpowerscriptsError from "./SfpowerscriptsError";

import { DeploymentResult } from "../impl/deploy/DeployImpl";

export default class ValidateError extends SfpowerscriptsError {

  /**
   * Payload for the results of the release
   */
  readonly data: DeploymentResult;

  /**
   * The underlying error that caused this error to be raised
   */
  readonly cause: Error

  constructor(
    message: string,
    data: DeploymentResult,
    cause?: Error
  ) {
    super(message);

    this.data = data;
    this.cause = cause;
  }
}
