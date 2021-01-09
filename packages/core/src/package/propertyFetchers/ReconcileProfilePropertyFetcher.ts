import { SFPPackage } from "../SFPPackage";
import { PropertyFetcher } from "./PropertyFetcher";

@PropertyFetcher.register
export class ReconcilePropertyFetcher  {
  getSfpowerscriptsProperties(packageContents: SFPPackage, packageLogger?: any) {
    if (packageContents.packageDescriptor.reconcileProfiles) {
      packageContents.reconcileProfiles=packageContents.packageDescriptor.reconcileProfiles;
    }
     
  }

}