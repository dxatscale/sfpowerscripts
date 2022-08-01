import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import Package2Detail from '../Package2Detail';
import InstallUnlockedPackageWrapper from '../../sfdxwrappers/InstallUnlockedPackageWrapper';
import SFPOrg from '../../org/SFPOrg';

export default class InstallUnlockedPackageCollection {
    private installedPackages: Package2Detail[];
    constructor(private sfpOrg: SFPOrg, private logger: Logger) {}

    public async install(
        package2s: Package2Detail[],
        skipIfInstalled: boolean,
        ignoreErrorIfAHigherVersionPackageIsInstalled: boolean = true
    ) {
        this.installedPackages = await this.sfpOrg.getAllInstalled2GPPackages();

        for (const package2 of package2s) {
            if (this.isPackageToBeInstalled(skipIfInstalled, package2.subscriberPackageVersionId)) {
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

                try {
                    await installUnlockedPackageWrapper.exec(true);
                } catch (error) {
                    let message: string = error.message;
                    if (
                        message.includes(`A newer version of this package is currently installed`) &&
                        ignoreErrorIfAHigherVersionPackageIsInstalled
                    ) {
                        SFPLogger.log(
                            `A higher version of this package is already installed and cant be dowgraded,skipping`,
                            LoggerLevel.INFO,
                            this.logger
                        );
                        continue;
                    } else throw error;
                }
            } else {
                SFPLogger.log(
                    `Skipping Installing of package ${package2.name} in ${this.sfpOrg.getUsername()}`,
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
                        `Package to be installed was not found in the target org  ${this.sfpOrg.getUsername()}, Proceeding to install.. `,
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
