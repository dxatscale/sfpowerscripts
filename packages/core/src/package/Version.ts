import semver = require("semver");

/**Helper functions for updating the project config */

export default class Version {

  private updatePkg; 
  private updateVersion;

  public constructor (
    private pkg?,
    private version?
  ){
    this.updatePkg = pkg; 
    this.updateVersion = version;
  }

  /**
   * get increased semver major versio
   * @param currentVersion 
   * @returns the increased semver major version
   */
  public static getMajor(currentVersion) {
    let verArr = currentVersion.split('.');
    currentVersion = verArr.splice(0, 3);
    let major = semver.inc(currentVersion.join('.'), 'major');
    major = major + '.' + verArr;
    return major;
  }

  /**
   * get increased semver minor version
   * @param currentVersion 
   * @returns the increased semver minor version
   */
  public static getMinor(currentVersion) {
    let verArr = currentVersion.split('.');
    currentVersion = verArr.splice(0, 3);
    let minor = semver.inc(currentVersion.join('.'), 'minor') + '.' + verArr;
    return minor;
  }

  /**
   * get increased semver patch version 
   * @param currentVersion 
   * @returns the increased semver major version
   */
  public static getPatch(currentVersion) {
    let verArr = currentVersion.split('.');
    currentVersion = verArr.splice(0, 3);
    let patch = semver.inc(currentVersion.join('.'), 'patch') + '.' + verArr;
    return patch;
  }

  /**
   * Gets the current build number
   * @param currentVersion 
   * @returns the current buildNumber 
   */
  public static getBuildNumber(currentVersion) {
    let verArr = currentVersion.split('.');
    return verArr[3];
  }

  /**
   * Resets the build number to 0 and returns the whole versionNumber
   * @param currentVersion 
   * @returns the current version with the build number set to 0
   */
  public resetBuildNumber(currentVersion) {
    let versionArr = currentVersion.split('.');
    versionArr[3] = '0';
    return versionArr.join('.');
  }

  /**
   * Checks if the build number is not zero
   * @param currentVersion 
   * @returns true if the build number is not 0, false if the build is 0
   */
  public hasNonZeroBuildNo(currentVersion) {
    if (!(currentVersion.includes('NEXT') || currentVersion.includes('LATEST'))) {
      if (Version.getBuildNumber(currentVersion) != '0') {
        return true;
      } else {
        return false;
      }
    }
    return false;
  }

  /**
   * Update the version number of the given package with the selection given
   * @param version 
   * @returns returns updated version number 
   */
  //increment 
  public static update(version, pkg) {
    if (version == 'major') {
      let updatedVersionNumber = Version.getMajor(pkg.versionNumber);
      return updatedVersionNumber;
    } else if (version == 'minor') {
      let updatedVersionNumber = Version.getMinor(pkg.versionNumber);
      return updatedVersionNumber;
    } else if (version == 'patch') {
      let updatedVersionNumber = Version.getPatch(pkg.versionNumber);
      return updatedVersionNumber;
    }
  }

  /**
   * 
   * @param inputtedNumber the number inputted by the user to verify
   * @returns false if the number is not valid
   * @returns the inputted number if valid
   */
  public static verifyCustom(inputtedNumber){
    let verArray = inputtedNumber.split('.');
    let validated = semver.valid(verArray.splice(0, 3).join('.'));
    if (validated != null && (!isNaN(verArray) || verArray == "NEXT")) {
      return inputtedNumber;
    } else {
      return false;
    }

  }
}