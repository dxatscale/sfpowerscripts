import semver = require("semver");

/**Helper functions for updating the project config */

export default class Update {

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
  public getMajor(currentVersion) {
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
  public getMinor(currentVersion) {
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
  public getPatch(currentVersion) {
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
  public getBuildNumber(currentVersion) {
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
      if (this.getBuildNumber(currentVersion) != '0') {
        return true;
      } else {
        return false;
      }
    }
    return false;
  }

  /**
   * Update the version number of the given package with the selection given
   * @param selection enum[major,minor,patch]
   * @param version the package with the version to be update
   * @returns returns updated version number 
   */
  public update() {
    if (this.updateVersion == 'major') {
      let updatedVersionNumber = this.getMajor(this.updatePkg.versionNumber);
      return updatedVersionNumber;
    } else if (this.updateVersion == 'minor') {
      let updatedVersionNumber = this.getMinor(this.updatePkg.versionNumber);
      return updatedVersionNumber;
    } else if (this.updateVersion == 'patch') {
      let updatedVersionNumber = this.getPatch(this.updatePkg.versionNumber);
      return updatedVersionNumber;
    }
  }


  /**
   * 
   * @param dependencies a map of dependencies chosen to be updated
   * @param packages the packages and dependencies with the current versions
   * @returns the updated packages and dependencies
   */
  public updateDependencies(dependencies, packages) {
    for (let pkg of packages) {
      if (pkg.dependencies != null) {
        for (let dependency of pkg.dependencies) {
          if (dependencies.has(dependency.package)) {
            let versionNumber = dependencies.get(dependency.package).split('.');
            if (versionNumber[3] == 'NEXT') { versionNumber[3] = 'LATEST'; }
            dependency.versionNumber = versionNumber.join('.');
          }
        }
      }
    }
    return packages;
  }
}