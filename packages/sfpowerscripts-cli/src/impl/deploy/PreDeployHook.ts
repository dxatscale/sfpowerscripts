import { Logger } from '@dxatscale/sfp-logger';
import SfpPackage from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackage';

export interface PreDeployHook {
    preDeployPackage(
        sfpPackage: SfpPackage,
        targetUsername: string,
        deployedPackages?:SfpPackage[],
        devhubUserName?: string,
        logger?:Logger,
    ): Promise<{ isToFailDeployment: boolean; message?: string }>;
}
