import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import PackageMetadataPrinter from '../../display/PackageMetadataPrinter';
import { InstallPackage, SfpPackageInstallationOptions } from './InstallPackage';
import InstallUnlockedPackageWrapper from '../../sfdxwrappers/InstallUnlockedPackageImpl';
import SfpPackage from '../SfpPackage';
import SFPOrg from '../../org/SFPOrg';


export default class InstallUnlockedPackageImpl extends InstallPackage {
    private packageVersionId;


    public constructor(
        sfpPackage: SfpPackage,
        targetOrg: SFPOrg,
        options: SfpPackageInstallationOptions,
        logger: Logger,
    ) {
        super(sfpPackage, targetOrg, logger,options);
        this.packageVersionId = sfpPackage.package_version_id;
        this.options = options;
    }

    public async install() {
        //Print Metadata carried in the package
        PackageMetadataPrinter.printMetadataToDeploy(this.sfpPackage?.payload, this.logger);

        let installUnlockedPackageWrapper: InstallUnlockedPackageWrapper = new InstallUnlockedPackageWrapper(
            this.logger,
            LoggerLevel.INFO,
            null,
             this.sfpOrg.getUsername(),
            this.packageVersionId,
            this.options.waitTime,
            this.options.publishWaitTime.toString(),
            this.options.installationkey,
            this.options.securitytype,
            this.options.upgradetype,
            this.options.apiVersion
        );
        SFPLogger.log(
            `Executing installation command: ${installUnlockedPackageWrapper.getGeneratedSFDXCommandWithParams()}`
        );
        await installUnlockedPackageWrapper.exec(false);
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
                    `Checking Whether Package with ID ${this.packageVersionId} is installed in  ${ this.sfpOrg.getUsername()}`,
                    null,
                    this.logger
                );
                let installedPackages = await this.sfpOrg.getAllInstalled2GPPackages();

                let packageFound = installedPackages.find((installedPackage) => {
                    return installedPackage.subscriberPackageVersionId === this.packageVersionId;
                });

                if (packageFound) {
                    SFPLogger.log(
                        `Package to be installed was found in the target org  ${ this.sfpOrg.getUsername()}`,
                        LoggerLevel.INFO,
                        this.logger
                    );
                    return false;
                } else {
                    SFPLogger.log(
                        `Package to be installed was not found in the target org  ${ this.sfpOrg.getUsername()}, Proceeding to instal.. `,
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
