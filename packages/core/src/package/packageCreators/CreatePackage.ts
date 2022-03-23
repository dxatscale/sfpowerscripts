import SFPLogger, { COLOR_HEADER, COLOR_KEY_MESSAGE, COLOR_WARNING, Logger, LoggerLevel } from '../../logger/SFPLogger';
import PackageMetadata from '../../PackageMetadata';
import SFPStatsSender from '../../stats/SFPStatsSender';
import ProjectConfig from '../../project/ProjectConfig';
import path from 'path';
import SourcePackageGenerator from '../generators/SourcePackageGenerator';

export abstract class CreatePackage {
    private startTime: number;

    // Child classes parse the project config again, to avoid mutation
    private packageManifest;
    private packageDescriptor;
    private packageDirectory;
    protected revisionFrom;
    protected revisionTo;

    constructor(
        protected projectDirectory: string,
        protected sfdx_package: string,
        protected packageArtifactMetadata: PackageMetadata,
        protected breakBuildIfEmpty: boolean = true,
        protected logger?: Logger,
        protected pathToReplacementForceIgnore?: string,
        protected configFilePath?: string
    ) {
        this.packageManifest = ProjectConfig.getSFDXPackageManifest(this.projectDirectory);
        //Get Package Descriptor
        this.packageDescriptor = ProjectConfig.getPackageDescriptorFromConfig(this.sfdx_package, this.packageManifest);
        this.packageDirectory = this.packageDescriptor['path'];
    }

    public async exec(): Promise<PackageMetadata> {
        //Get Type of Package
        this.packageArtifactMetadata.package_type = this.getTypeOfPackage();

        this.packageArtifactMetadata.apiVersion = this.packageManifest.sourceApiVersion;

        //Capture Start Time
        this.startTime = Date.now();

        //Print Header
        this.printHeader();

        //Resolve to the actual directory
        let resolvedPackageDirectory;
        if (this.projectDirectory != null) {
            resolvedPackageDirectory = path.join(this.projectDirectory, this.packageDirectory);
        } else {
            resolvedPackageDirectory = this.packageDirectory;
        }

        //Check if the package is empty
        await this.checkWhetherProvidedPackageIsEmpty(resolvedPackageDirectory);
        //Call lifecycle commands
        await this.preCreatePackage(resolvedPackageDirectory, this.packageDescriptor);
        await this.createPackage(resolvedPackageDirectory, this.packageDescriptor);
        await this.postCreatePackage(resolvedPackageDirectory, this.packageDescriptor);

        //Add addtional descriptors available
        this.writeDeploymentStepsToArtifact(this.packageDescriptor);

        //Genrate Artifact
        await this.generateArtifact(resolvedPackageDirectory);

        //Send Metrics to Logging system
        this.sendMetricsWhenSuccessfullyCreated();

        return this.packageArtifactMetadata;
    }

    abstract getTypeOfPackage();

    abstract preCreatePackage(packageDirectory: string, packageDescriptor: any);
    abstract createPackage(packageDirectory: string, packageDescriptor: any);
    abstract postCreatePackage(packageDirectory: string, packageDescriptor: any);

    public setDiffRevisons(revisionFrom: string, revisionTo: string) {
        this.revisionFrom = revisionFrom;
        this.revisionTo = revisionTo;
    }

    private sendMetricsWhenSuccessfullyCreated() {
        let elapsedTime = Date.now() - this.startTime;

        this.packageArtifactMetadata.creation_details = {
            creation_time: elapsedTime,
            timestamp: Date.now(),
        };

        if (this.getTypeOfPackage() === 'source' || this.getTypeOfPackage() === 'unlocked')
            SFPStatsSender.logGauge('package.metadatacount', this.packageArtifactMetadata.metadataCount, {
                package: this.packageArtifactMetadata.package_name,
                type: this.packageArtifactMetadata.package_type,
            });

        SFPStatsSender.logCount('package.created', {
            package: this.packageArtifactMetadata.package_name,
            type: this.packageArtifactMetadata.package_type,
            is_dependency_validated: String(this.packageArtifactMetadata.isDependencyValidated),
        });

        SFPStatsSender.logElapsedTime(
            'package.elapsed.time',
            this.packageArtifactMetadata.creation_details.creation_time,
            {
                package: this.packageArtifactMetadata.package_name,
                type: this.packageArtifactMetadata.package_type,
                is_dependency_validated: 'false',
            }
        );
    }

    private writeDeploymentStepsToArtifact(packageDescriptor: any) {
        if (packageDescriptor.assignPermSetsPreDeployment) {
            if (packageDescriptor.assignPermSetsPreDeployment instanceof Array)
                this.packageArtifactMetadata.assignPermSetsPreDeployment =
                    packageDescriptor.assignPermSetsPreDeployment;
            else throw new Error("Property 'assignPermSetsPreDeployment' must be of type array");
        }

        if (packageDescriptor.assignPermSetsPostDeployment) {
            if (packageDescriptor.assignPermSetsPostDeployment instanceof Array)
                this.packageArtifactMetadata.assignPermSetsPostDeployment =
                    packageDescriptor.assignPermSetsPostDeployment;
            else throw new Error("Property 'assignPermSetsPostDeployment' must be of type array");
        }
    }

    private async generateArtifact(packageDirectory: string) {
        //Get Artifact Detailes
        let sourcePackageArtifactDir = await SourcePackageGenerator.generateSourcePackageArtifact(
            this.logger,
            this.projectDirectory,
            this.sfdx_package,
            packageDirectory,
            this.packageDescriptor.destructiveChangePath,
            this.configFilePath,
            this.pathToReplacementForceIgnore,
            this.revisionFrom,
            this.revisionTo
        );

        this.packageArtifactMetadata.sourceDir = sourcePackageArtifactDir;
    }

    private async checkWhetherProvidedPackageIsEmpty(packageDirectory: string) {
        if (await this.isEmptyPackage(packageDirectory)) {
            if (this.breakBuildIfEmpty) throw new Error(`Package directory ${packageDirectory} is empty`);
            else this.printEmptyArtifactWarning();
        }
    }

    abstract isEmptyPackage(packageDirectory: string);

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
            COLOR_HEADER(`package name: ${COLOR_KEY_MESSAGE(`${this.sfdx_package}`)}`),
            LoggerLevel.INFO,
            this.logger
        );
        SFPLogger.log(
            COLOR_HEADER(`package type: ${COLOR_KEY_MESSAGE(`${this.getTypeOfPackage()}`)}`),
            LoggerLevel.INFO,
            this.logger
        );

        SFPLogger.log(
            COLOR_HEADER(`package directory: ${COLOR_KEY_MESSAGE(`${this.packageDirectory}`)}`),
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
