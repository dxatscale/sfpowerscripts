 import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import Package2Detail from '../Package2Detail';
import InstallUnlockedPackageImpl from './InstallUnlockedPackageImpl';
import SFPOrg from '../../org/SFPOrg';
import { SfpPackageInstallationOptions } from './InstallPackage';

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
                let installUnlockedPackageImpl: InstallUnlockedPackageImpl = new InstallUnlockedPackageImpl(
                    this.logger,
                    this.sfpOrg.getUsername(),
                    package2.subscriberPackageVersionId,
                    new SfpPackageInstallationOptions(),
                    package2.name
                );
                if(package2.key)
                installUnlockedPackageImpl.setInstallationKey(package2.key);
                try {
                    await installUnlockedPackageImpl.install();
                } catch (error) {
                    let message: string = error.message;
                    if (
                        message.includes(`A newer version of this package is currently installed`) &&
                        ignoreErrorIfAHigherVersionPackageIsInstalled
                    ) {
                        SFPLogger.log(
                            `A higher version of this package is already installed and cant be dowgraded,skipping`,
                            LoggerLevel.WARN,
                            this.logger
                        );
                        continue;
                    } else
                    {
                        SFPLogger.log(
                            `Unable to install ${package2.name}  in ${this.sfpOrg.getUsername()} due to ${message}`,
                            LoggerLevel.ERROR,
                            this.logger
                        );
                        throw error;
                    }
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
                    `Checking Whether Package with ID ${packageVersionId} is installed in ${this.sfpOrg.getUsername()}`,
                    null,
                    this.logger
                );

                let packageFound = this.installedPackages.find((installedPackage) => {
                    return installedPackage.subscriberPackageVersionId.substring(0,14) === packageVersionId.substring(0,14);
                });

                if (packageFound) {
                    SFPLogger.log(
                        `Package to be installed was found in the target org ${this.sfpOrg.getUsername()}`,
                        LoggerLevel.INFO,
                        this.logger
                    );
                    return false;
                } else {
                    SFPLogger.log(
                        `Package to be installed was not found in the target org ${this.sfpOrg.getUsername()}, Proceeding to install.. `,
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
