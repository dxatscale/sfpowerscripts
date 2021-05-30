import SfpowerscriptsError from "../../../errors/SfpowerscriptsError";


export default class PreRequisiteCheckError extends SfpowerscriptsError {

  /**
   * Payload for the results of the describe results
   */
  readonly data: any;

  /**
   * The underlying error that caused this error to be raised
   */
  readonly cause: Error

  constructor(
    message: string,
    data: any,
    cause?: Error
  ) {
    super(message);

    this.data = data;
    this.cause = cause;
  }
}
