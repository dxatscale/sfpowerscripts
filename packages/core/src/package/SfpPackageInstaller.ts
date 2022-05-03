import path from 'path';
import { Logger, LoggerLevel } from '../logger/SFPLogger';
import SFPOrg from '../org/SFPOrg';
import InstallDataPackageImpl from './packageInstallers/InstallDataPackageImpl';
import { SfpPackageInstallationOptions } from './packageInstallers/InstallPackage';
import InstallSourcePackageImpl from './packageInstallers/InstallSourcePackageImpl';
import InstallUnlockedPackageImpl from './packageInstallers/InstallUnlockedPackageImpl';
import { PackageInstallationResult } from './packageInstallers/PackageInstallationResult';
import SfpPackage from './SfpPackage';

export default class SfpPackageInstaller {
    public static async installPackage(
        logger: Logger,
        sfpPackage: SfpPackage,
        targetOrg: SFPOrg,
        installationOptions: SfpPackageInstallationOptions,
        installationContext?: SfPPackageInstallationContext,
        overridePackageTypeWith?: string
    ): Promise<PackageInstallationResult> {
        let packageType = sfpPackage.packageType.toLocaleLowerCase();
        if (overridePackageTypeWith) packageType = overridePackageTypeWith;

        switch (packageType) {
            case 'unlocked':
                let installUnlockedPackageImpl: InstallUnlockedPackageImpl = new InstallUnlockedPackageImpl(
                    sfpPackage,
                    targetOrg.getUsername(),
                    installationOptions,
                    logger
                );
                installUnlockedPackageImpl.isArtifactToBeCommittedInOrg = !installationOptions.disableArtifactCommit;
                return installUnlockedPackageImpl.exec();
            case 'source':
                installationOptions.pathToReplacementForceIgnore =   installationContext?.currentStage == 'prepare'
                ? path.join(sfpPackage.sourceDir, 'forceignores', '.prepareignore')
                : null;
                let installSourcePackageImpl: InstallSourcePackageImpl = new InstallSourcePackageImpl(
                    sfpPackage,
                    targetOrg.getUsername(),
                    installationOptions,
                    logger
                );
                installSourcePackageImpl.isArtifactToBeCommittedInOrg = !installationOptions.disableArtifactCommit;
                return installSourcePackageImpl.exec();
            case 'data':
                let installDataPackageImpl: InstallDataPackageImpl = new InstallDataPackageImpl(
                    sfpPackage,
                    targetOrg.getUsername(),
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
