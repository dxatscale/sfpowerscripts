import SFPPackage from '@dxatscale/sfpowerscripts.core/lib/package/SFPPackage';

export interface PreDeployHook {
    preDeployPackage(
        sfpPackage: SFPPackage,
        targetUsername: string,
        devhubUserName?: string
    ): Promise<{ isToFailDeployment: boolean; message?: string }>;
}
