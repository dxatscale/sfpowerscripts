import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";

export default class ProjectValidation {

  private readonly projectConfig;

  constructor(){
    this.projectConfig = ProjectConfig.getSFDXPackageManifest(null);
  }

  validatePackageBuildNumbers() {
    this.projectConfig.packageDirectories.forEach((pkg) => {
      let packageType = ProjectConfig.getPackageType(
        this.projectConfig,
        pkg.package
      );

      let pattern: RegExp = /NEXT$|LATEST$/i;
      if (
        pkg.versionNumber.match(pattern) &&
        (packageType === "Source" || packageType === "Data")
      ) {
        throw new Error('The build-number keywords "NEXT" & "LATEST" are not supported for Source & Data packages');
      }
    });
  }
}
