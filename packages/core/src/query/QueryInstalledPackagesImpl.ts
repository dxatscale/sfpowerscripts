import { Connection } from "@salesforce/core";
import QueryHelper from "./QueryHelper";

export default class QueryInstalledPackagesImpl {

  static async exec(conn: Connection) {
    const installedPackagesQuery =
    "SELECT Id, SubscriberPackageId, SubscriberPackage.NamespacePrefix, SubscriberPackage.Name, " +
    "SubscriberPackageVersion.Id, SubscriberPackageVersion.Name, SubscriberPackageVersion.MajorVersion, SubscriberPackageVersion.MinorVersion, " +
    "SubscriberPackageVersion.PatchVersion, SubscriberPackageVersion.BuildNumber, SubscriberPackageVersion.Package2ContainerOptions, SubscriberPackageVersion.IsOrgDependent FROM InstalledSubscriberPackage " +
    "ORDER BY SubscriberPackageId";

    return await QueryHelper.query(installedPackagesQuery, conn, true);
  }
}