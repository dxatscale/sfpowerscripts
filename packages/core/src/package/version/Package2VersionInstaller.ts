import { Logger, LoggerLevel } from '@dxatscale/sfp-logger';

export default class Package2VersionInstaller {
    public constructor(
        logger: Logger,
        logLevel: LoggerLevel,
        working_directory: string,
        private targetUserName: string,
        private packageId: string,
        private waitTime: string,
        private publishWaitTime?: string,
        private installationkey?: string,
        private securityType?: string,
        private upgradeType?: string,
        private apiVersion?: string,
        private apexCompile: string = 'package'
    ) {}

    public setInstallationKey(installationKey: string) {
        this.installationkey = installationKey;
    }


    

}
