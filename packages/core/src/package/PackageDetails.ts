export default interface PackageDetails {
  name: string;
  subscriberPackageId: string,
  namespacePrefix: string,
  subscriberPackageVersionId: string,
  versionNumber: string,
  type: string,
  isOrgDependent: boolean
}