import { Connection } from "@salesforce/core";
import QueryHelper from "../../queryHelper/QueryHelper";

export default class InstalledPackagesQueryExecutor {

  static async exec(conn: Connection) {
    const installedPackagesQuery =
    "SELECT Id, SubscriberPackageId, SubscriberPackage.NamespacePrefix, SubscriberPackage.Name, " +
    "SubscriberPackageVersion.Id, SubscriberPackageVersion.Name, SubscriberPackageVersion.MajorVersion, SubscriberPackageVersion.MinorVersion, " +
    "SubscriberPackageVersion.PatchVersion, SubscriberPackageVersion.BuildNumber, SubscriberPackageVersion.Package2ContainerOptions, SubscriberPackageVersion.IsOrgDependent FROM InstalledSubscriberPackage " +
    "ORDER BY SubscriberPackageId";

    return QueryHelper.query<any>(installedPackagesQuery, conn, true);
  }
}