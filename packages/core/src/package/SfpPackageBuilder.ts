import ApexTypeFetcher from '../apex/parser/ApexTypeFetcher';
import ProjectConfig from '../project/ProjectConfig';
import SfpPackageContentGenerator from './generators/SfpPackageContentGenerator';
import SourceToMDAPIConvertor from './packageFormatConvertors/SourceToMDAPIConvertor';
import PackageManifest from './PackageManifest';
import MetadataCount from './MetadataCount';
import SFPLogger, { Logger, LoggerLevel } from '../logger/SFPLogger';
import * as fs from 'fs-extra';
import path from 'path';
import { Artifact } from '../artifacts/ArtifactFetcher';
import SfpPackage, { DiffPackageMetadata, PackageType, SfpPackageParams } from './SfpPackage';
import PropertyFetcher from './propertyFetchers/PropertyFetcher';
import AssignPermissionSetFetcher from './propertyFetchers/AssignPermissionSetFetcher';
import DestructiveManifestPathFetcher from './propertyFetchers/DestructiveManifestPathFetcher';
import ReconcilePropertyFetcher from './propertyFetchers/ReconcileProfilePropertyFetcher';
import CreateUnlockedPackageImpl from './packageCreators/CreateUnlockedPackageImpl';
import CreateSourcePackageImpl from './packageCreators/CreateSourcePackageImpl';
import CreateDataPackageImpl from './packageCreators/CreateDataPackageImpl';
import ImpactedApexTestClassFetcher from '../apextest/ImpactedApexTestClassFetcher';
import * as rimraf from 'rimraf';
import PackageToComponent from './PackageToComponent';
import { EOL } from 'os';

export default class SfpPackageBuilder {
    public static async buildPackageFromProjectDirectory(
        logger: Logger,
        projectDirectory: string,
        sfdx_package: string,
        params?: SfpPackageParams,
        packageCreationParams?: PackageCreationParams
    ) {
        let propertyFetchers: PropertyFetcher[] = [
            new AssignPermissionSetFetcher(),
            new DestructiveManifestPathFetcher(),
            new ReconcilePropertyFetcher(),
        ];

        let startTime = Date.now;
        let sfpPackage: SfpPackage = new SfpPackage();
        sfpPackage.package_name = sfdx_package;
        sfpPackage.projectConfig = ProjectConfig.getSFDXProjectConfig(projectDirectory);
        sfpPackage.apiVersion = sfpPackage.projectConfig.sourceApiVersion;
        sfpPackage.packageDescriptor = ProjectConfig.getSFDXPackageDescriptor(projectDirectory, sfdx_package);
        sfpPackage.projectDirectory = projectDirectory;
        sfpPackage.packageDirectory = sfpPackage.packageDescriptor.path;

        //set additional options
        sfpPackage.sourceVersion = params?.sourceVersion;
        sfpPackage.branch = params?.branch;
        sfpPackage.repository_url = params?.repositoryUrl;
        sfpPackage.package_version_number = params?.packageVersionNumber;

        if (params?.configFilePath == null) sfpPackage.configFilePath = 'config/project-scratch-def.json';
        else sfpPackage.configFilePath = params?.configFilePath;

        for (const propertyFetcher of propertyFetchers) {
            await propertyFetcher.getSfpowerscriptsProperties(sfpPackage, logger);
        }

        // Requires destructiveChangesPath which is set by the property fetcher
        sfpPackage.workingDirectory = await SfpPackageContentGenerator.generateSfpPackageDirectory(
            logger,
            sfpPackage.projectDirectory,
            sfpPackage.packageName,
            sfpPackage.packageDescriptor.path,
            sfpPackage.destructiveChangesPath,
            sfpPackage.configFilePath,
            params?.pathToReplacementForceIgnore,
            params?.revisionFrom,
            params?.revisionTo
        );

        sfpPackage.resolvedPackageDirectory = path.join(sfpPackage.workingDirectory, sfpPackage.packageDescriptor.path);

        sfpPackage.package_type = ProjectConfig.getPackageType(
            ProjectConfig.getSFDXProjectConfig(sfpPackage.workingDirectory),
            sfdx_package
        );

        //Don't proceed further if packageType is Data
        if (sfpPackage.package_type != PackageType.Data) {
            let sourceToMdapiConvertor = new SourceToMDAPIConvertor(
                sfpPackage.workingDirectory,
                sfpPackage.packageDescriptor.path,
                ProjectConfig.getSFDXProjectConfig(sfpPackage.workingDirectory).sourceApiVersion,
                logger
            );
            sfpPackage.mdapiDir = (await sourceToMdapiConvertor.convert()).packagePath;
            const packageManifest: PackageManifest = await PackageManifest.create(sfpPackage.mdapiDir);

            sfpPackage.payload = packageManifest.manifestJson;
            sfpPackage.triggers = packageManifest.fetchTriggers();
            sfpPackage.isApexFound = packageManifest.isApexInPackage();
            sfpPackage.isProfilesFound = packageManifest.isProfilesInPackage();
            sfpPackage.isPermissionSetGroupFound = packageManifest.isPermissionSetGroupsFoundInPackage();
            sfpPackage.isPayLoadContainTypesSupportedByProfiles = packageManifest.isPayLoadContainTypesSupportedByProfiles();

            let apexFetcher: ApexTypeFetcher = new ApexTypeFetcher(sfpPackage.mdapiDir);
            sfpPackage.apexClassesSortedByTypes = apexFetcher.getClassesClassifiedByType();
            sfpPackage.apexTestClassses = apexFetcher.getTestClasses();
            sfpPackage.metadataCount = MetadataCount.getMetadataCount(
                sfpPackage.workingDirectory,
                sfpPackage.packageDescriptor.path
            );
            sfpPackage.apexClassWithOutTestClasses = apexFetcher.getClassesOnlyExcludingTestsAndInterfaces();

            sfpPackage.isTriggerAllTests = this.isAllTestsToBeTriggered(sfpPackage,logger);
            
            //Introspect Diff Package Created
            //On Failure.. remove diff and move on
            try {
                await this.introspectDiffPackageCreated(sfpPackage, params, logger);
            } catch (error) {
                SFPLogger.log('Failed in diff compute with ' + JSON.stringify(error), LoggerLevel.INFO, logger);
                let workingDirectory = path.join(sfpPackage.workingDirectory, 'diff');
                if (fs.existsSync(workingDirectory)) {
                    rimraf.sync(workingDirectory);
                }
                sfpPackage.diffPackageMetadata = undefined;
            }
        }

        //Create the actual package
        let createPackage;

        if (!packageCreationParams) packageCreationParams = { breakBuildIfEmpty: true };

        let packageType = sfpPackage.packageType;
        if (params?.overridePackageTypeWith) packageType = params?.overridePackageTypeWith.toLocaleLowerCase();

        //Get Implementors
        switch (packageType) {
            case PackageType.Unlocked:
                createPackage = new CreateUnlockedPackageImpl(
                    sfpPackage.workingDirectory,
                    sfpPackage,
                    packageCreationParams,
                    logger,
                    params
                );
                break;
            case PackageType.Source:
                createPackage = new CreateSourcePackageImpl(
                    sfpPackage.workingDirectory,
                    sfpPackage,
                    packageCreationParams,
                    logger,
                    params
                );
                break;
            case PackageType.Data:
                createPackage = new CreateDataPackageImpl(
                    sfpPackage.workingDirectory,
                    sfpPackage,
                    packageCreationParams,
                    logger,
                    params
                );
                break;
        }

        return createPackage.exec();
    }

    public static async buildPackageFromArtifact(artifact: Artifact, logger: Logger): Promise<SfpPackage> {
        //Read artifact metadata
        let sfpPackage = new SfpPackage();
        Object.assign(sfpPackage, fs.readJSONSync(artifact.packageMetadataFilePath, { encoding: 'utf8' }));
        sfpPackage.sourceDir = artifact.sourceDirectoryPath;
        sfpPackage.changelogFilePath = artifact.changelogFilePath;

        sfpPackage.projectConfig = ProjectConfig.getSFDXProjectConfig(artifact.sourceDirectoryPath);
        sfpPackage.packageDescriptor = ProjectConfig.getSFDXPackageDescriptor(
            artifact.sourceDirectoryPath,
            sfpPackage.package_name
        );
        sfpPackage.projectDirectory = artifact.sourceDirectoryPath;
        sfpPackage.packageDirectory = sfpPackage.packageDescriptor.path;
        sfpPackage.isTriggerAllTests = this.isAllTestsToBeTriggered(sfpPackage,logger);

        return sfpPackage;
    }

    private static async introspectDiffPackageCreated(
        sfpPackage: SfpPackage,
        packageParams: SfpPackageParams,
        logger: Logger
    ): Promise<void> {
        //No base branch passed in, dont create diff
        if (!packageParams.revisionFrom) return;

        let workingDirectory = path.join(sfpPackage.workingDirectory, 'diff');
        if (fs.existsSync(workingDirectory)) {
            
            let changedComponents = new PackageToComponent(
                sfpPackage.packageName,
                path.join(workingDirectory, sfpPackage.packageDirectory)
            ).generateComponents();

            let impactedApexTestClassFetcher: ImpactedApexTestClassFetcher = new ImpactedApexTestClassFetcher(
                sfpPackage,
                changedComponents,
                logger
            );
            let impactedTestClasses = await impactedApexTestClassFetcher.getImpactedTestClasses();

            let sourceToMdapiConvertor = new SourceToMDAPIConvertor(
                workingDirectory,
                sfpPackage.packageDescriptor.path,
                ProjectConfig.getSFDXProjectConfig(workingDirectory).sourceApiVersion,
                logger
            );

            let mdapiDirPath = (await sourceToMdapiConvertor.convert()).packagePath;

            const packageManifest: PackageManifest = await PackageManifest.create(mdapiDirPath);

            let diffPackageInfo: DiffPackageMetadata = {};
            diffPackageInfo.invalidatedTestClasses = impactedTestClasses;
            diffPackageInfo.isApexFound = packageManifest.isApexInPackage();
            diffPackageInfo.isProfilesFound = packageManifest.isProfilesInPackage();
            diffPackageInfo.isPermissionSetFound = packageManifest.isPermissionSetsInPackage();
            diffPackageInfo.isPermissionSetGroupFound = packageManifest.isPermissionSetGroupsFoundInPackage();
            diffPackageInfo.isPayLoadContainTypesSupportedByProfiles = packageManifest.isPayLoadContainTypesSupportedByProfiles();
            diffPackageInfo.sourceVersionFrom = packageParams.revisionFrom;
            diffPackageInfo.sourceVersionTo = packageParams.revisionTo;

            diffPackageInfo.metadataCount = MetadataCount.getMetadataCount(
                workingDirectory,
                sfpPackage.packageDescriptor.path
            );
            sfpPackage.diffPackageMetadata = diffPackageInfo;
        }
    }

    private static isAllTestsToBeTriggered(sfpPackage:SfpPackage,logger:Logger) {
        if (
            this.isOptimizedDeploymentForSourcePackage(sfpPackage) == false || (sfpPackage.packageType == PackageType.Source &&
            sfpPackage.isApexFound == true &&
            sfpPackage.apexTestClassses == null)
        ) {
            SFPLogger.log(
                ` ----------------------------------WARNING!  NON OPTIMAL DEPLOYMENT--------------------------------------------${EOL}` +
                    `This package has apex classes/triggers, In order to deploy optimally, each class need to have a minimum ${EOL}` +
                    `75% test coverage,We are unable to find any test classes in the given package, hence will be deploying ${EOL}` +
                    `via triggering all local tests,This definitely is not optimal approach on large orgs` +
                    `Please consider adding test classes for the classes in the package ${EOL}` +
                    `-------------------------------------------------------------------------------------------------------------`,
                LoggerLevel.INFO,
                logger
            );
            return true;
        } else return false;
    }

        // Allow individual packages to use non optimized path
        private static isOptimizedDeploymentForSourcePackage(pkgDescriptor: any): boolean {
            if (pkgDescriptor['isOptimizedDeployment'] == null) return true;
            else return pkgDescriptor['isOptimizedDeployment'];
        }
    
}

// Options while creating package
export class PackageCreationParams {
    breakBuildIfEmpty: boolean = true;
    devHub?: string;
    installationkeybypass?: boolean;
    installationkey?: string;
    waitTime?: string;
    isCoverageEnabled?: boolean;
    isSkipValidation?: boolean;
    isComputeDiffPackage?: boolean;
    baseBranch?: string;
}
