export default abstract class SfpowerscriptsError extends Error{

  readonly message: string
  readonly code: string
  /**
   * The underlying error that caused this error to be raised
   */
  readonly cause: Error
  /**
   * Additional payload for the error
   */
  abstract data: unknown

  constructor(message: string, code?: string, cause?: Error) {
    super(message);

    this.message = message;
    this.code = code;
    this.cause = cause;
  }
}
