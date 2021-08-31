import semver = require("semver");

export default class Dependencies {

  private dependencyMap; 
  private packages; 

  constructor(
    private pkgs,
    private dependencies
  ){
    this.packages = pkgs;
    this.dependencyMap = dependencies;

  }

   /**
   * 
   * @param dependencies a map of dependencies chosen to be updated
   * @param packages the packages and dependencies with the current versions
   * @returns the updated packages and dependencies
   */
    public update() {
      for (let pkg of this.packages) {
        if (pkg.dependencies != null) {
          for (let dependency of pkg.dependencies) {
            if (this.dependencyMap.has(dependency.package)) {
              let versionNumber = this.dependencyMap.get(dependency.package).split('.');
              if (versionNumber[3] == 'NEXT') { versionNumber[3] = 'LATEST'; }
              dependency.versionNumber = versionNumber.join('.');
            }
          }
        }
      }
      return this.packages;
    }
  }