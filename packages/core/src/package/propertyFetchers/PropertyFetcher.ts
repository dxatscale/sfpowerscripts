import { Logger } from '@dxatscale/sfp-logger';
import SfpPackage from '../SfpPackage';

export default interface PropertyFetcher {
    /**
     * Retrieves property from packageDescriptor and adds its to SfpPackage by reference
     * @param packageContents
     * @param packageLogger
     */
    getSfpowerscriptsProperties(packageContents: SfpPackage, packageLogger?: Logger);
}
