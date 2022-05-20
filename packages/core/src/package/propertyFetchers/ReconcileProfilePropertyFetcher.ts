import SfpPackage from '../SfpPackage';
import PropertyFetcher from './PropertyFetcher';

export default class ReconcilePropertyFetcher implements PropertyFetcher {
    getSfpowerscriptsProperties(packageContents: SfpPackage, packageLogger?: any) {
        if (packageContents.packageDescriptor.hasOwnProperty('reconcileProfiles')) {
            packageContents.reconcileProfiles = packageContents.packageDescriptor.reconcileProfiles;
        }
    }
}
