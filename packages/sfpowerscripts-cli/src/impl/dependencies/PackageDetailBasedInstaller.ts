import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import SFPOrg from '@dxatscale/sfpowerscripts.core/lib/org/SFPOrg';
import InstallUnlockedPackageWrapper from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallUnlockedPackageImpl';
import Package2Detail from '@dxatscale/sfpowerscripts.core/lib/package/Package2Detail';

export class PackageDetailBasedInstaller {
    private installedPackages: Package2Detail[];
    constructor(
        private sfpOrg: SFPOrg,
        private package2s: Package2Detail[],
        private skipIfInstalled: boolean,
        private logger: Logger
    ) {}

    public async install() {
        this.installedPackages = await this.sfpOrg.getAllInstalled2GPPackages();

        for (const package2 of this.package2s) {
            if (this.isPackageToBeInstalled(this.skipIfInstalled, package2.subscriberPackageVersionId)) {
                SFPLogger.log(
                    `Installing Package ${package2.name} in ${this.sfpOrg.getUsername()}`,
                    LoggerLevel.INFO,
                    this.logger
                );
                let installUnlockedPackageWrapper: InstallUnlockedPackageWrapper = new InstallUnlockedPackageWrapper(
                    this.logger,
                    LoggerLevel.INFO,
                    null,
                    this.sfpOrg.getUsername(),
                    package2.subscriberPackageVersionId,
                    '120'
                );

                await installUnlockedPackageWrapper.exec(true);
            } else {
                SFPLogger.log(
                    `Skipping Installing of package ${package2.name} in ${this.sfpOrg.getAlias()}`,
                    LoggerLevel.INFO,
                    this.logger
                );
            }
        }
    }

    /**
     * Checks whether unlocked package version is installed in org.
     * Overrides base class method.
     * @param skipIfPackageInstalled
     * @returns
     */
    protected isPackageToBeInstalled(skipIfPackageInstalled: boolean, packageVersionId: string): boolean {
        try {
            if (skipIfPackageInstalled) {
                SFPLogger.log(
                    `Checking Whether Package with ID ${packageVersionId} is installed in  ${this.sfpOrg.getUsername()}`,
                    null,
                    this.logger
                );

                let packageFound = this.installedPackages.find((installedPackage) => {
                    return installedPackage.subscriberPackageVersionId === packageVersionId;
                });

                if (packageFound) {
                    SFPLogger.log(
                        `Package to be installed was found in the target org  ${this.sfpOrg.getUsername()}`,
                        LoggerLevel.INFO,
                        this.logger
                    );
                    return false;
                } else {
                    SFPLogger.log(
                        `Package to be installed was not found in the target org  ${this.sfpOrg.getUsername()}, Proceeding to instal.. `,
                        LoggerLevel.INFO,
                        this.logger
                    );
                    return true;
                }
            } else {
                SFPLogger.log(
                    'Skip if package to be installed is false, Proceeding with installation',
                    LoggerLevel.INFO,
                    this.logger
                );
                return true;
            }
        } catch (error) {
            SFPLogger.log(
                'Unable to check whether this package is installed in the target org',
                LoggerLevel.INFO,
                this.logger
            );
            return true;
        }
    }
}
