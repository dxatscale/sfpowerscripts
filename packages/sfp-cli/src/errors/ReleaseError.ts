import SfpError from './SfpError';

import { ReleaseResult } from '../impl/release/ReleaseImpl';

export default class ReleaseError extends SfpError {
    /**
     * Payload for the results of the release
     */
    readonly data: ReleaseResult;

    /**
     * The underlying error that caused this error to be raised
     */
    readonly cause: Error;

    constructor(message: string, data: ReleaseResult, cause?: Error) {
        super(message);

        this.data = data;
        this.cause = cause;
    }
}
