import SFPLogger, { COLOR_HEADER, COLOR_KEY_MESSAGE, COLOR_WARNING, Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import SFPStatsSender from '../../stats/SFPStatsSender';
import SfpPackage, { PackageType, SfpPackageParams } from '../SfpPackage';
import { PackageCreationParams } from '../SfpPackageBuilder';

export abstract class CreatePackage {
    private startTime: number;

    constructor(
        protected projectDirectory: string,
        protected sfpPackage: SfpPackage,
        protected packageCreationParams?: PackageCreationParams,
        protected logger?: Logger,
        protected params?: SfpPackageParams
    ) {
        //Initialize Params
        if (this.params == null) this.params = {};
    }

    public async exec(): Promise<SfpPackage> {
        //Capture Start TimegetSFDXProjectConfig
        this.startTime = Date.now();

        //Print Header
        this.printHeader();

        //Check if the package is empty
        await this.checkWhetherProvidedPackageIsEmpty(this.sfpPackage.packageDescriptor.path);
        //Call lifecycle commands
        await this.preCreatePackage(this.sfpPackage);
        await this.createPackage(this.sfpPackage);
        await this.postCreatePackage(this.sfpPackage);

        //Add addtional descriptors available
        this.writeDeploymentStepsToArtifact(this.sfpPackage);

        //Send Metrics to Logging system
        this.sendMetricsWhenSuccessfullyCreated();

        return this.sfpPackage;
    }

    abstract getTypeOfPackage();

    abstract preCreatePackage(sfpPackage: SfpPackage);
    abstract createPackage(sfpPackage: SfpPackage);
    abstract postCreatePackage(sfpPackage: SfpPackage);

    private sendMetricsWhenSuccessfullyCreated() {
        let elapsedTime = Date.now() - this.startTime;

        this.sfpPackage.creation_details = {
            creation_time: elapsedTime,
            timestamp: Date.now(),
        };

        if (this.getTypeOfPackage() === PackageType.Source || this.getTypeOfPackage() === PackageType.Unlocked)
            SFPStatsSender.logGauge('package.metadatacount', this.sfpPackage.metadataCount, {
                package: this.sfpPackage.package_name,
                type: this.sfpPackage.package_type,
            });

        SFPStatsSender.logCount('package.created', {
            package: this.sfpPackage.package_name,
            type: this.sfpPackage.package_type,
            is_dependency_validated: String(this.sfpPackage.isDependencyValidated),
        });

        SFPStatsSender.logElapsedTime('package.elapsed.time', this.sfpPackage.creation_details.creation_time, {
            package: this.sfpPackage.package_name,
            type: this.sfpPackage.package_type,
            is_dependency_validated: String(this.sfpPackage.isDependencyValidated),
        });
        SFPStatsSender.logElapsedTime('package.creation.elapsed_time', this.sfpPackage.creation_details.creation_time, {
            package: this.sfpPackage.package_name,
            type: this.sfpPackage.package_type,
            is_dependency_validated: String(this.sfpPackage.isDependencyValidated),
        });
    }

    private writeDeploymentStepsToArtifact(packageDescriptor: any) {
        if (packageDescriptor.assignPermSetsPreDeployment) {
            if (packageDescriptor.assignPermSetsPreDeployment instanceof Array)
                this.sfpPackage.assignPermSetsPreDeployment = packageDescriptor.assignPermSetsPreDeployment;
            else throw new Error("Property 'assignPermSetsPreDeployment' must be of type array");
        }

        if (packageDescriptor.assignPermSetsPostDeployment) {
            if (packageDescriptor.assignPermSetsPostDeployment instanceof Array)
                this.sfpPackage.assignPermSetsPostDeployment = packageDescriptor.assignPermSetsPostDeployment;
            else throw new Error("Property 'assignPermSetsPostDeployment' must be of type array");
        }
    }

    private async checkWhetherProvidedPackageIsEmpty(packageDirectory: string) {
        if (await this.isEmptyPackage(this.projectDirectory, packageDirectory)) {
            if (this.packageCreationParams.breakBuildIfEmpty)
                throw new Error(`Package directory ${packageDirectory} is empty`);
            else this.printEmptyArtifactWarning();
        }
    }

    abstract isEmptyPackage(projectDirectory: string, packageDirectory: string);

    protected printEmptyArtifactWarning() {
        SFPLogger.log(
            `${COLOR_WARNING(
                `---------------------WARNING! Empty aritfact encountered-------------------------------`
            )}`,
            LoggerLevel.INFO,
            this.logger
        );
        SFPLogger.log(
            'Either this folder is empty or the application of .forceignore results in an empty folder',
            LoggerLevel.INFO,
            this.logger
        );
        SFPLogger.log('Proceeding to create an empty artifact', LoggerLevel.INFO, this.logger);
        SFPLogger.log(
            `${COLOR_WARNING(
                `---------------------------------------------------------------------------------------`
            )}`,
            LoggerLevel.INFO,
            this.logger
        );
    }

    private printHeader() {
        SFPLogger.log(COLOR_HEADER(`command: ${COLOR_KEY_MESSAGE(`create  package`)}`), LoggerLevel.INFO, this.logger);
        SFPLogger.log(
            COLOR_HEADER(`package name: ${COLOR_KEY_MESSAGE(`${this.sfpPackage.packageName}`)}`),
            LoggerLevel.INFO,
            this.logger
        );
        SFPLogger.log(
            COLOR_HEADER(`package type: ${COLOR_KEY_MESSAGE(`${this.getTypeOfPackage()}`)}`),
            LoggerLevel.INFO,
            this.logger
        );

        SFPLogger.log(
            COLOR_HEADER(`package directory: ${COLOR_KEY_MESSAGE(`${this.sfpPackage.packageDescriptor.path}`)}`),
            LoggerLevel.INFO,
            this.logger
        );

        this.printAdditionalPackageSpecificHeaders();

        SFPLogger.log(
            `${COLOR_HEADER(
                `-------------------------------------------------------------------------------------------`
            )}`,
            LoggerLevel.INFO,
            this.logger
        );
    }

    abstract printAdditionalPackageSpecificHeaders();
}
