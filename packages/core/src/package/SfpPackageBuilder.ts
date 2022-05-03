import ApexTypeFetcher, { ApexSortedByType } from '../apex/parser/ApexTypeFetcher';
import ProjectConfig from '../project/ProjectConfig';
import SfpPackageContentGenerator from './generators/SfpPackageContentGenerator';
import SourceToMDAPIConvertor from './packageFormatConvertors/SourceToMDAPIConvertor';
import PackageManifest from './PackageManifest';
import MetadataCount from './MetadataCount';
import { COLOR_KEY_MESSAGE, Logger } from '../logger/SFPLogger';
import * as fs from 'fs-extra';
import path from 'path';
import { Artifact } from '../artifacts/ArtifactFetcher';
import _ from 'lodash';
import SfpPackage, { DiffPackageMetadata, SfpPackageParams } from './SfpPackage';
import PropertyFetcher from './propertyFetchers/PropertyFetcher';
import AssignPermissionSetFetcher from './propertyFetchers/AssignPermissionSetFetcher';
import DestructiveManifestPathFetcher from './propertyFetchers/DestructiveManifestPathFetcher';
import ReconcilePropertyFetcher from './propertyFetchers/ReconcileProfilePropertyFetcher';
import CreateUnlockedPackageImpl from './packageCreators/CreateUnlockedPackageImpl';
import CreateSourcePackageImpl from './packageCreators/CreateSourcePackageImpl';
import CreateDataPackageImpl from './packageCreators/CreateDataPackageImpl';
import ChangedComponentsFetcher from '../dependency/ChangedComponentsFetcher';
import ImpactedApexTestClassFetcher from '../apextest/ImpactedApexTestClassFetcher';

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

        if (params?.overridePackageTypeWith) {
            sfpPackage.package_type = params?.overridePackageTypeWith;
        } else
            sfpPackage.package_type = ProjectConfig.getPackageType(
                ProjectConfig.getSFDXProjectConfig(sfpPackage.workingDirectory),
                sfdx_package
            );

        //Don't proceed further if packageType is Data
        if (sfpPackage.package_type != 'Data') {
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

            //Introspect Diff Package Created
            await this.introspectDiffPackageCreated(sfpPackage, packageCreationParams,logger);
        }

        //Create the actual package
        let createPackage;
        if (params?.overridePackageTypeWith) sfpPackage.packageType = params?.overridePackageTypeWith.toLocaleLowerCase();
        if (!packageCreationParams) packageCreationParams = { breakBuildIfEmpty: true };

        //Get Implementors
        switch (sfpPackage.packageType.toLocaleLowerCase()) {
            case 'unlocked':
                createPackage = new CreateUnlockedPackageImpl(
                    sfpPackage.workingDirectory,
                    sfpPackage,
                    packageCreationParams,
                    logger,
                    params
                );
                break;
            case 'source':
                createPackage = new CreateSourcePackageImpl(
                    sfpPackage.workingDirectory,
                    sfpPackage,
                    packageCreationParams,
                    logger,
                    params
                );
                break;
            case 'data':
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

        return sfpPackage;
    }

    private static async introspectDiffPackageCreated(sfpPackage: SfpPackage, packageCreationParams:PackageCreationParams,logger: Logger): Promise<void> {
        let workingDirectory = path.join(sfpPackage.workingDirectory, 'diff');
        if (fs.existsSync(workingDirectory)) {
            let sourceToMdapiConvertor = new SourceToMDAPIConvertor(
                workingDirectory,
                sfpPackage.packageDescriptor.path,
                ProjectConfig.getSFDXProjectConfig(workingDirectory).sourceApiVersion,
                logger
            );
        
            

            let mdapiDirPath = (await sourceToMdapiConvertor.convert()).packagePath;

            //Compute Changed Components
            let changedComponents=await (new ChangedComponentsFetcher(packageCreationParams.baseBranch,false)).fetch();

            let impactedApexTestClassFetcher: ImpactedApexTestClassFetcher = new ImpactedApexTestClassFetcher(
                sfpPackage,
                changedComponents,
                logger
            );
            let impactedTestClasses = await impactedApexTestClassFetcher.getImpactedTestClasses();
         
            const packageManifest: PackageManifest = await PackageManifest.create(mdapiDirPath);
            let diffPackageInfo: DiffPackageMetadata = {};
            diffPackageInfo.invalidatedTestClasses = impactedTestClasses;
            diffPackageInfo.isApexFound = packageManifest.isApexInPackage();
            diffPackageInfo.isProfilesFound = packageManifest.isProfilesInPackage();
            diffPackageInfo.isPermissionSetFound =  packageManifest.isPermissionSetsInPackage();
            diffPackageInfo.isPermissionSetGroupFound = packageManifest.isPermissionSetGroupsFoundInPackage();
            diffPackageInfo.metadataCount = MetadataCount.getMetadataCount(
                workingDirectory,
                sfpPackage.packageDescriptor.path
            );
            sfpPackage.diffPackageMetadata = diffPackageInfo;
        }
    }
}

export class PackageCreationParams {
    breakBuildIfEmpty: boolean = true;
    devHub?: string;
    installationkeybypass?: boolean;
    installationkey?: string;
    waitTime?: string;
    isCoverageEnabled?: boolean;
    isSkipValidation?: boolean;
    isComputeDiffPackage?: boolean;
    baseBranch?:string;
}
