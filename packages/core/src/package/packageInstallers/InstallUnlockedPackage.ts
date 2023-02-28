import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import PackageMetadataPrinter from '../../display/PackageMetadataPrinter';
import { InstallPackage, SfpPackageInstallationOptions } from './InstallPackage';
import SfpPackage from '../SfpPackage';
import SFPOrg from '../../org/SFPOrg';
import InstallUnlockedPackageImpl from './InstallUnlockedPackageImpl';
import { COLOR_KEY_MESSAGE } from '@dxatscale/sfp-logger';
import { EOL } from 'os';

export default class InstallUnlockedPackage extends InstallPackage {
    private packageVersionId;

    public constructor(
        sfpPackage: SfpPackage,
        targetOrg: SFPOrg,
        options: SfpPackageInstallationOptions,
        logger: Logger
    ) {
        super(sfpPackage, targetOrg, logger, options);
        this.packageVersionId = sfpPackage.package_version_id;
        this.options = options;
    }

    public async install() {
        let installUnlockedPackageWrapper: InstallUnlockedPackageImpl = new InstallUnlockedPackageImpl(
            this.logger,
            this.sfpOrg.getUsername(),
            this.packageVersionId,
            this.options,
            this.sfpPackage.packageName
        );
        await installUnlockedPackageWrapper.install(this.sfpPackage.payload);
    }

    /**
     * Checks whether unlocked package version is installed in org.
     * Overrides base class method.
     * @param skipIfPackageInstalled
     * @returns
     */
    protected async isPackageToBeInstalled(skipIfPackageInstalled: boolean): Promise<boolean> {
        try {
            if (skipIfPackageInstalled) {
                SFPLogger.log(
                    `${EOL}Checking whether package ${COLOR_KEY_MESSAGE(
                        this.sfpPackage.package_name
                    )} with ID ${COLOR_KEY_MESSAGE(
                        this.packageVersionId
                    )} is installed in ${this.sfpOrg.getUsername()}`,
                    LoggerLevel.INFO,
                    this.logger
                );
                let installedPackages = await this.sfpOrg.getAllInstalled2GPPackages();

                let packageFound = installedPackages.find((installedPackage) => {
                    return installedPackage.subscriberPackageVersionId.substring(0,14) === this.packageVersionId.substring(0,14);
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
