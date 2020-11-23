
export type PackageInstallationResult = {
  result: PackageInstallationStatus
  deploy_id?:string;
  message?:string;
}

export enum PackageInstallationStatus {
  Skipped,
  Succeeded,
  Failed
}