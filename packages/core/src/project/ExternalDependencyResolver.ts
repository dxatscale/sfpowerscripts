import { Org } from "@salesforce/core";
import _ from "lodash";


export default class ExternalDependencyResolver
{

   public constructor(private hubOrg:Org,private projectConfig:any)
   {
   }

    private isSubscriberPackageVersionId(packageAlias: string): boolean {
      const subscriberPackageVersionIdPrefix = '04t';
      return packageAlias.startsWith(subscriberPackageVersionIdPrefix);
  }
}

export interface ExternalPackageDependencies
{
   packages?:Package2[],
   installationOrder?:Package2Version[]
}
export interface Package2
{
  name:string,
  Package2Id?:string,
  version?:Package2Version[],
}
export interface Package2Version
{
    versionNumber?:string,
    SubscriberPackageVersionId?:string
}