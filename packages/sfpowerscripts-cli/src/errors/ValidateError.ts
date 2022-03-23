import SfpowerscriptsError from './SfpowerscriptsError';
import ValidateResult from '../impl/validate/ValidateResult';

export default class ValidateError extends SfpowerscriptsError {
    /**
     * Payload for the results of the release
     */
    readonly data: ValidateResult;

    /**
     * The underlying error that caused this error to be raised
     */
    readonly cause: Error;

    constructor(message: string, data: ValidateResult, cause?: Error) {
        super(message);

        this.data = data;
        this.cause = cause;
    }
}
