import { PackageInstallationResult } from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/PackageInstallationResult';
import SfpPackage from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackage';

export interface PostDeployHook {
    postDeployPackage(
        sfpPackage: SfpPackage,
        packageInstallationResult: PackageInstallationResult,
        targetUsername: string,
        devhubUserName?: string
    ): Promise<{ isToFailDeployment: boolean; message?: string }>;
}
