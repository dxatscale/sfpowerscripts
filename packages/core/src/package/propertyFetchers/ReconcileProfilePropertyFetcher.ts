import SFPPackage  from "../SFPPackage";
import PropertyFetcher from "./PropertyFetcher";

export default class ReconcilePropertyFetcher implements PropertyFetcher {

  getSfpowerscriptsProperties(packageContents: SFPPackage, packageLogger?: any) {
    if (packageContents.packageDescriptor.hasOwnProperty('reconcileProfiles')) {
      packageContents.reconcileProfiles=packageContents.packageDescriptor.reconcileProfiles;
    }
  }
}
