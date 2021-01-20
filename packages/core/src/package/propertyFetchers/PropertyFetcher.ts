import SFPPackage  from "../SFPPackage";

export default interface PropertyFetcher {

  /**
   * Retrieves property from packageDescriptor and adds its to SFPPackage by reference
   * @param packageContents
   * @param packageLogger
   */
  getSfpowerscriptsProperties(packageContents:SFPPackage, packageLogger?:any);
}
