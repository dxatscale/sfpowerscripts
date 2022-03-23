import { PackageInstallationResult } from '@dxatscale/sfpowerscripts.core/lib/package/packageInstallers/PackageInstallationResult';
import SFPPackage from '@dxatscale/sfpowerscripts.core/lib/package/SFPPackage';

export interface PostDeployHook {
    postDeployPackage(
        sfpPackage: SFPPackage,
        packageInstallationResult: PackageInstallationResult,
        targetUsername: string,
        devhubUserName?: string
    ): Promise<{ isToFailDeployment: boolean; message?: string }>;
}
