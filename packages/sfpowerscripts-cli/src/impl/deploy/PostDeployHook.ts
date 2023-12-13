import { Logger } from '@flxblio/sfp-logger';
import { PackageInstallationResult } from '../../core/package/packageInstallers/PackageInstallationResult';
import SfpPackage from '../../core/package/SfpPackage';

export interface PostDeployHook {
    postDeployPackage(
        sfpPackage: SfpPackage,
        packageInstallationResult: PackageInstallationResult,
        targetUsername: string,
        deployedPackages?:SfpPackage[],
        devhubUserName?: string,
        logger?:Logger
    ): Promise<{ isToFailDeployment: boolean; message?: string }>;
}
