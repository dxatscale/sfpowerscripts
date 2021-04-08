export default abstract class SfpowerscriptsError extends Error{

  readonly message: string
  readonly code: string

  /**
   * Additional payload for the error
   */
  abstract data: unknown

  constructor(message: string, code?: string) {
    super(message);

    this.message = message;
    this.code = code;
  }
}
