import { Connection } from "@salesforce/core";
import InstalledPackagesQueryExecutor from "./InstalledPackagesQueryExecutor";
import PackageDetails from "../PackageDetails";

export default class InstalledPackagesFetcher {

  constructor(
    private conn: Connection
  ) {}

  async fetchAllPackages(): Promise<PackageDetails[]> {
    const installedPackages: PackageDetails[] = [];

    let records = await InstalledPackagesQueryExecutor.exec(this.conn);

    records.forEach((record) => {
      let packageVersionNumber = `${record.SubscriberPackageVersion.MajorVersion}.${record.SubscriberPackageVersion.MinorVersion}.${record.SubscriberPackageVersion.PatchVersion}.${record.SubscriberPackageVersion.BuildNumber}`;

      let packageDetails: PackageDetails = {
        name: record.SubscriberPackage.Name,
        subscriberPackageId: record.SubscriberPackageId,
        namespacePrefix: record.SubscriberPackage.NamespacePrefix,
        subscriberPackageVersionId: record.SubscriberPackageVersion.Id,
        versionNumber: packageVersionNumber,
        type: record.SubscriberPackageVersion.Package2ContainerOptions,
        isOrgDependent: record.SubscriberPackageVersion.IsOrgDependent
      };

      installedPackages.push(packageDetails);
    });

    return installedPackages;
  }

  async fetchManagedPackages(): Promise<PackageDetails[]> {
    const installedPackages = await this.fetchAllPackages();

    return installedPackages.filter((installedPackage) => installedPackage.type === "Managed");
  }
}