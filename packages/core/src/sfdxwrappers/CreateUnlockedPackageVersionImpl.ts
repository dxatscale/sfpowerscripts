import { SFDXCommand } from "../command/SFDXCommand";
import { Logger, LoggerLevel } from "../logger/SFPLogger";

export default class CreateUnlockedPackageVersionImpl extends SFDXCommand {
  constructor(
    private devHub: string,
    private projectDirectory: string,
    private sfdxPackage: string,
    private waitTime: string,
    private configFilePath: string,
    protected logger: Logger,
    protected logLevel: LoggerLevel,
    private versionNumber?: string,
    private isByPassInstallationKey: boolean = true,
    private installationKey?: string,
    private tag?: string,
    private isSkipValidation: boolean = false,
    private isOrgDependentPackage: boolean = false,
    private isCoverageEnabled: boolean = true
  ) {
    super(null, projectDirectory, logger, logLevel);
  }

  getSFDXCommand(): string {
    return "sfdx force:package:version:create";
  }
  getCommandName(): string {
    return "PackageVersionCreate";
  }
  getGeneratedParams(): string {
    let params = `-p ${this.sfdxPackage}  -w ${this.waitTime} --definitionfile ${this.configFilePath}`;

    if (this.versionNumber) params += `  --versionnumber ${this.versionNumber}`;

    if (this.isByPassInstallationKey) params += ` -x`;
    else params += ` -k ${this.installationKey}`;

    if (this.tag) params += ` -t ${this.tag}`;

    if (this.isCoverageEnabled && !this.isOrgDependentPackage) params += ` -c`;

    if (this.isSkipValidation && !this.isOrgDependentPackage)
      params += ` --skipvalidation`;

    params += ` -v ${this.devHub}`;

    return params;
  }
}
