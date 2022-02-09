import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata"

export interface DeploymentResult {
  scheduled: number;
  deployed: PackageInfo[];
  failed: PackageInfo[];
  testFailure: PackageInfo;
  error: any;
}

export interface PackageInfo {
  sourceDirectory: string;
  packageMetadata: PackageMetadata;
  versionInstalledInOrg?: string
  isPackageInstalled?: boolean;
}