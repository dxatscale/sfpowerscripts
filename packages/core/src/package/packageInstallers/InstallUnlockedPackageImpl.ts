import SFPLogger, { COLOR_KEY_MESSAGE, COLOR_SUCCESS, Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import PackageMetadataPrinter from '../../display/PackageMetadataPrinter';
import SFPOrg from '../../org/SFPOrg';
import { PackageInstallCreateRequest, PackagingSObjects, SubscriberPackageVersion } from '@salesforce/packaging';
import { delay } from '../../utils/Delay';
import { SfpPackageInstallationOptions } from './InstallPackage';



export default class InstallUnlockedPackageImpl {
    public constructor(
        private logger: Logger,
        private targetUserName: string,
        private packageId: string,
        private installationOptions: SfpPackageInstallationOptions,
        private packageName?:string
    ) {
    }

    public setInstallationKey(installationKey: string) {
        this.installationOptions.installationkey = installationKey;
    }

    public async install(payloadToDisplay?: any): Promise<any> {
        let connection = (await SFPOrg.create({ aliasOrUsername: this.targetUserName })).getConnection();
        //Print Metadata carried in the package
        if (payloadToDisplay) PackageMetadataPrinter.printMetadataToDeploy(payloadToDisplay, this.logger);

        const subscriberPackageVersion = new SubscriberPackageVersion({
            connection,
            aliasOrId: this.packageId,
            password: this.installationOptions.installationkey,
        });

        const request: PackageInstallCreateRequest = {
            SubscriberPackageVersionKey: await subscriberPackageVersion.getId(),
            Password: this.installationOptions.installationkey as PackageInstallCreateRequest['Password'],
            ApexCompileType: 'package' as PackageInstallCreateRequest['ApexCompileType'],
            SecurityType: this.installationOptions.securitytype as PackageInstallCreateRequest['SecurityType'],
            UpgradeType: this.installationOptions.upgradetype as PackageInstallCreateRequest['UpgradeType'],
            EnableRss: true,
        };

        //Fire a package installation
        let pkgInstallRequest = await subscriberPackageVersion.install(request, {});
        let status = this.parseStatus(
            pkgInstallRequest,
            this.targetUserName,
            this.packageName ? this.packageName : this.packageId,
            this.logger
        );
        while (status == 'IN_PROGRESS') {
            pkgInstallRequest = await SubscriberPackageVersion.getInstallRequest(pkgInstallRequest.Id, connection);
            status = this.parseStatus(
                pkgInstallRequest,
                this.targetUserName,
                this.packageName ? this.packageName : this.packageId,
                this.logger
            );
            await delay(30000); //Poll every 30 seconds
        }
    }
    public parseStatus(
        request: PackagingSObjects.PackageInstallRequest,
        username: string,
        pkgName: string,
        logger: Logger
    ): 'IN_PROGRESS' | 'SUCCESS' {
        const { Status } = request;
        if (Status === 'SUCCESS') {
            SFPLogger.log(
                `Status: ${COLOR_SUCCESS(`Succesfully Installed`)} ${pkgName} to ${username} with Id ${request.Id}`,
                LoggerLevel.INFO,
                logger
            );
            return Status;
        } else if (['IN_PROGRESS', 'UNKNOWN'].includes(Status)) {
            SFPLogger.log(
                `Status: ${COLOR_KEY_MESSAGE(`In Progress`)} Installing ${pkgName} to ${username} with Id ${request.Id}`,
                LoggerLevel.INFO,
                logger
            );
            return 'IN_PROGRESS';
        } else {
            let errorMessage = '<empty>';
            const errors = request?.Errors?.errors;
            if (errors?.length) {
                errorMessage = 'Installation errors: ';
                for (let i = 0; i < errors.length; i++) {
                    errorMessage += `\n${i + 1}) ${errors[i].message}`;
                }
            }
            throw new Error(`Unable to install ${pkgName} due to \n` + errorMessage);
        }
    }
}
