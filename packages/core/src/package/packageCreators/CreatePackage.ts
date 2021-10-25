import PackageMetadata from "../../PackageMetadata";
import SFPStatsSender from "../../stats/SFPStatsSender";

export abstract class CreatePackage 
{
   private startTime: number;

   constructor(protected packageArtifactMetadata:PackageMetadata)
   {

   }
   
   public async exec():Promise<PackageMetadata>
   {

   }
   
   abstract preCreatePackage();
   abstract createPackage();
   abstract postCreatePackage();

   private sendMetricsWhenSuccessfullyCreated() {
    let elapsedTime = Date.now() - this.startTime;
    SFPStatsSender.logCount("package.created", {
      package: this.packageArtifactMetadata.package_name,
      type: this.packageArtifactMetadata.package_type,
      is_dependency_validated: String(
        this.packageArtifactMetadata.isDependencyValidated
      ),
    });
  }

}