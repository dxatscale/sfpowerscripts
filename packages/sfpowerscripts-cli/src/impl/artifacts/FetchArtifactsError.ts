
import SfpError from '../../errors/SfpError';
import { ArtifactVersion } from './FetchImpl';


export default class FetchArtifactsError extends SfpError {
    /**
     * Payload consisting of artifacts that succeeded and failed to fetch
     */
    readonly data: {
        success: ArtifactVersion[];
        failed: ArtifactVersion[];
    };

    /**
     * The underlying error that caused this error to be raised
     */
    readonly cause: Error;

    constructor(message: string, data: { success:ArtifactVersion[]; failed: ArtifactVersion[] }, cause: Error) {
        super(message);

        this.data = data;
        this.cause = cause;
    }
}
