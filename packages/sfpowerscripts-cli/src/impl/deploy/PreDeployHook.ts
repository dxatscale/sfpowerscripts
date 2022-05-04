import SfpPackage from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackage';

export interface PreDeployHook {
    preDeployPackage(
        sfpPackage: SfpPackage,
        targetUsername: string,
        devhubUserName?: string
    ): Promise<{ isToFailDeployment: boolean; message?: string }>;
}
