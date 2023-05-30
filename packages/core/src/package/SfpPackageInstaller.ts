import path from 'path';
import { Logger } from '@dxatscale/sfp-logger';
import SFPOrg from '../org/SFPOrg';
import InstallDataPackageImpl from './packageInstallers/InstallDataPackageImpl';
import { SfpPackageInstallationOptions } from './packageInstallers/InstallPackage';
import InstallSourcePackageImpl from './packageInstallers/InstallSourcePackageImpl';
import InstallUnlockedPackage from './packageInstallers/InstallUnlockedPackage';
import { PackageInstallationResult } from './packageInstallers/PackageInstallationResult';
import SfpPackage, { PackageType } from './SfpPackage';

export default class SfpPackageInstaller {
    public static async installPackage(
        logger: Logger,
        sfpPackage: SfpPackage,
        targetOrg: SFPOrg,
        installationOptions: SfpPackageInstallationOptions,
        installationContext?: SfPPackageInstallationContext,
        overridePackageTypeWith?: string
    ): Promise<PackageInstallationResult> {
        let packageType = sfpPackage.packageType;
        if (overridePackageTypeWith) packageType = overridePackageTypeWith;

        switch (packageType) {
            case PackageType.Unlocked:
                let installUnlockedPackageImpl: InstallUnlockedPackage = new InstallUnlockedPackage(
                    sfpPackage,
                    targetOrg,
                    installationOptions,
                    logger
                );
                installUnlockedPackageImpl.isArtifactToBeCommittedInOrg = !installationOptions.disableArtifactCommit;
                return installUnlockedPackageImpl.exec();
            case PackageType.Diff:
            case PackageType.Source:
                installationOptions.pathToReplacementForceIgnore =   installationContext?.currentStage == 'prepare'
                ? path.join(sfpPackage.sourceDir, 'forceignores', '.prepareignore')
                : null;
                let installSourcePackageImpl: InstallSourcePackageImpl = new InstallSourcePackageImpl(
                    sfpPackage,
                    targetOrg,
                    installationOptions,
                    logger
                );
                installSourcePackageImpl.isArtifactToBeCommittedInOrg = !installationOptions.disableArtifactCommit;
                return installSourcePackageImpl.exec();
            case PackageType.Data:
                let installDataPackageImpl: InstallDataPackageImpl = new InstallDataPackageImpl(
                    sfpPackage,
                    targetOrg,
                    logger,
                    installationOptions
                );
                installDataPackageImpl.isArtifactToBeCommittedInOrg = !installationOptions.disableArtifactCommit;
                return installDataPackageImpl.exec();
            default:
                throw new Error('Unknown Package Type');
        }
    }
}

export class SfPPackageInstallationContext {
    currentStage: string;
}
