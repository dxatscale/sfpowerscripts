import { Logger } from '@flxblio/sfp-logger';
import SfpPackage from '../../core/package/SfpPackage';

export interface PreDeployHook {
    preDeployPackage(
        sfpPackage: SfpPackage,
        targetUsername: string,
        deployedPackages?:SfpPackage[],
        devhubUserName?: string,
        logger?:Logger,
    ): Promise<{ isToFailDeployment: boolean; message?: string }>;
}
