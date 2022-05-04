import SfpPackage from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackage';

export interface DeploymentResult {
    scheduled: number;
    deployed: PackageInfo[];
    failed: PackageInfo[];
    testFailure: PackageInfo;
    error: any;
}

export interface PackageInfo {
    sourceDirectory: string;
    sfpPackage: SfpPackage;
    versionInstalledInOrg?: string;
    isPackageInstalled?: boolean;
}
