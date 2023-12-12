import SFPLogger, { LoggerLevel, Logger } from '@dxatscale/sfp-logger';
import { ApexSortedByType } from '../../apex/parser/ApexTypeFetcher';
import SFPStatsSender from '../../stats/SFPStatsSender';
import PackageEmptyChecker from '../validators/PackageEmptyChecker';
import SfpPackage, { DiffPackageMetadata, PackageType, SfpPackageParams } from '../SfpPackage';
import { PackageCreationParams } from '../SfpPackageBuilder';
import SFPOrg from '../../org/SFPOrg';
import CreateSourcePackageImpl from './CreateSourcePackageImpl';
import PackageToComponent from '../components/PackageToComponent';
import path from 'path';
import * as fs from 'fs-extra';
import ImpactedApexTestClassFetcher from '../../apextest/ImpactedApexTestClassFetcher';
import SourceToMDAPIConvertor from '../packageFormatConvertors/SourceToMDAPIConvertor';
import PackageManifest from '../components/PackageManifest';
import MetadataCount from '../components/MetadataCount';
import * as rimraf from 'rimraf';
import Component from '../../dependency/Component';
import PackageComponentDiff from '../diff/PackageComponentDiff';
import { BuildStreamService } from '../../eventStream/build';

export default class CreateDiffPackageImp extends CreateSourcePackageImpl {
    public constructor(
        protected projectDirectory: string,
        protected sfpPackage: SfpPackage,
        protected packageCreationParams: PackageCreationParams,
        protected logger?: Logger,
        protected params?: SfpPackageParams
    ) {
        super(projectDirectory, sfpPackage, packageCreationParams, logger, params);
    }

    getTypeOfPackage() {
        return PackageType.Diff;
    }

    printAdditionalPackageSpecificHeaders() {}

    isEmptyPackage(projectDirectory: string, packageDirectory: string) {
        return PackageEmptyChecker.isEmptyFolder(projectDirectory, packageDirectory);
    }

    async preCreatePackage(sfpPackage: SfpPackage) {
        const devhubOrg = await SFPOrg.create({ aliasOrUsername: this.packageCreationParams.devHub });

        //Fetch Baseline commit from DevHub
        let commitsOfPackagesInstalledInDevHub = await this.getCommitsOfPackagesInstalledInDevHub(devhubOrg);

        if (this.packageCreationParams.revisionFrom) {
            this.sfpPackage.commitSHAFrom = this.packageCreationParams.revisionFrom;
        } else if (commitsOfPackagesInstalledInDevHub[this.sfpPackage.packageName]) {
            this.sfpPackage.commitSHAFrom = commitsOfPackagesInstalledInDevHub[this.sfpPackage.packageName];
        } else {
            this.sfpPackage.commitSHAFrom = this.sfpPackage.sourceVersion;
        }

        if (this.packageCreationParams.revisionTo) {
            this.sfpPackage.commitSHATo = this.packageCreationParams.revisionTo;
        } else {
            this.sfpPackage.commitSHATo = this.sfpPackage.sourceVersion;
        }
    }

    private async getCommitsOfPackagesInstalledInDevHub(diffTargetSfpOrg: SFPOrg) {
        let installedArtifacts = await diffTargetSfpOrg.getInstalledArtifacts();
        let packagesInstalledInOrgMappedToCommits = await this.mapInstalledArtifactstoPkgAndCommits(installedArtifacts);
        return packagesInstalledInOrgMappedToCommits;
    }

    public async createPackage(sfpPackage: SfpPackage) {
        //Unresolved SHAs can be same if the package is not installed in the org or is the same
        if (this.sfpPackage.commitSHAFrom != this.sfpPackage.commitSHATo) {
            try {
                let packageComponentDiffer: PackageComponentDiff = new PackageComponentDiff(
                    this.logger,
                    this.sfpPackage.packageName,
                    this.sfpPackage.commitSHAFrom,
                    this.sfpPackage.commitSHATo,
                    true
                );
                await packageComponentDiffer.build(path.join(sfpPackage.workingDirectory, 'diff'));
            } catch (error) {
                //if both are same after git resolution.. just do nothing, treat is a normal source package
                if (error.message.includes('Unable to compute diff, as both commits are same')) {
                    BuildStreamService.sendPackageError(this.sfpPackage,`Unable to compute diff, as both commits are same`)
                    SFPLogger.log(
                        `Both commits are same, treating it as an empty package`,
                        LoggerLevel.WARN,
                        this.logger
                    );
                    //Create an empty diff directory to force skip of packages
                    const diffSrcDir = path.join(sfpPackage.workingDirectory, `diff/${sfpPackage.packageDirectory}`);
                    fs.mkdirpSync(diffSrcDir);
                } else {
                    BuildStreamService.sendPackageError(this.sfpPackage,`Unable to create diff package`)
                    throw error;
                }
            }

            await this.introspectDiffPackageCreated(sfpPackage, this.params, this.logger);

            await this.replaceSourceWithDiff(
                sfpPackage.workingDirectory,
                sfpPackage.packageDirectory,
                `diff/${sfpPackage.packageDirectory}`
            );

            SFPStatsSender.logGauge('package.metadatacount', sfpPackage.metadataCount, {
                package: sfpPackage.packageName,
                type: sfpPackage.packageType,
            });
        }
    }

    postCreatePackage(sfpPackage) {}

    private async replaceSourceWithDiff(
        workingDirectory: string,
        packageDirectory: string,
        diffPackageDirectory: string
    ) {
        const srcDir = path.join(workingDirectory, packageDirectory);
        const diffSrcDir = path.join(workingDirectory, diffPackageDirectory);

        // Check if src directories exist, if so remove them
        if (fs.pathExistsSync(srcDir)) await fs.remove(srcDir);

        // Rename diff/src directory to src
        if (fs.pathExistsSync(diffSrcDir)) await fs.move(diffSrcDir, srcDir);
        else {
            // Ensure package directory exists
            await fs.mkdirpSync(diffSrcDir);
            await fs.move(diffSrcDir, srcDir);
        }

        //check if destructiveChanges.xml exist in diff directory
        const destructiveChangesPath = path.join(workingDirectory, 'diff', 'destructiveChanges.xml');
        if (fs.existsSync(destructiveChangesPath)) {
            //Move destructiveChanges.xml to diff directory
            await fs.move(destructiveChangesPath, path.join(workingDirectory, 'destructiveChanges.xml'));
        }
        //remove diffSrcDir
        if (fs.pathExistsSync(path.join(workingDirectory, 'diff')))
            fs.rmSync(path.join(workingDirectory, 'diff'), { recursive: true, force: true });
    }

    async mapInstalledArtifactstoPkgAndCommits(installedArtifacts: any) {
        let packagesMappedToLastKnownCommitId: { [p: string]: string } = {};
        packagesMappedToLastKnownCommitId = await getPackagesToCommits(installedArtifacts);

        return packagesMappedToLastKnownCommitId;

        async function getPackagesToCommits(installedArtifacts: any): Promise<{ [p: string]: string }> {
            const packagesToCommits: { [p: string]: string } = {};
            let jsonOverrides = {};

            // Add an option to override diff package from during debugging
            // Also useful for when the record is yet to be baselined
            try {
                const jsonData = await fs.readFile('diffPackageOverrides.json', 'utf8');
                jsonOverrides = JSON.parse(jsonData);
            } catch (error) {
                console.log('No JSON override file found or there is an error reading it');
            }

            // Merge the installedArtifacts data with the JSON overrides
            if (installedArtifacts) {
                installedArtifacts.forEach((artifact) => {
                    packagesToCommits[artifact.Name] = artifact.CommitId__c;
                });
            }

            // Add additional packages from the JSON overrides that are not in installedArtifacts
            Object.keys(jsonOverrides).forEach((pkgName) => {
                if (!packagesToCommits.hasOwnProperty(pkgName)) {
                    packagesToCommits[pkgName] = jsonOverrides[pkgName];
                }
            });

            if (process.env.VALIDATE_REMOVE_PKG) delete packagesToCommits[process.env.VALIDATE_REMOVE_PKG];

            return packagesToCommits;
        }
    }

    private async introspectDiffPackageCreated(
        sfpPackage: SfpPackage,
        packageParams: SfpPackageParams,
        logger: Logger
    ): Promise<void> {
        let workingDirectory = path.join(sfpPackage.workingDirectory, 'diff');
        if (fs.existsSync(path.join(workingDirectory, sfpPackage.packageDirectory))) {
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

            //Convert again for finding the values in the diff package
            let sourceToMdapiConvertor = new SourceToMDAPIConvertor(
                workingDirectory,
                sfpPackage.packageDescriptor.path,
                sfpPackage.apiVersion,
                logger
            );

            let mdapiDirPath = (await sourceToMdapiConvertor.convert()).packagePath;

            const packageManifest: PackageManifest = await PackageManifest.create(mdapiDirPath);

            sfpPackage.payload = packageManifest.manifestJson;
            sfpPackage.apexTestClassses = impactedTestClasses;
            sfpPackage.apexClassWithOutTestClasses = getOnlyChangedClassesFromPackage(
                changedComponents,
                sfpPackage.apexClassesSortedByTypes
            );
            sfpPackage.isApexFound = packageManifest.isApexInPackage();
            sfpPackage.isProfilesFound = packageManifest.isProfilesInPackage();
            sfpPackage.isPermissionSetGroupFound = packageManifest.isPermissionSetGroupsFoundInPackage();
            sfpPackage.isPayLoadContainTypesSupportedByProfiles = packageManifest.isPayLoadContainTypesSupportedByProfiles();

            sfpPackage.metadataCount = await MetadataCount.getMetadataCount(
                workingDirectory,
                sfpPackage.packageDescriptor.path
            );
            rimraf.sync(mdapiDirPath);
        } else {
            //Souce Diff Directory is empty
            sfpPackage.payload = {};
            sfpPackage.apexTestClassses = [];
            sfpPackage.apexClassWithOutTestClasses = [];
            sfpPackage.isApexFound = false;
            sfpPackage.isProfilesFound = false;
            sfpPackage.isPermissionSetGroupFound = false;
            sfpPackage.isPayLoadContainTypesSupportedByProfiles = false;
            sfpPackage.metadataCount = 0;
        }

        function getOnlyChangedClassesFromPackage(
            changedComponents: Component[],
            apexClassesSortedByTypes: ApexSortedByType
        ): string[] {
            // Check if the parameters are not empty or undefined
            if (!changedComponents || !apexClassesSortedByTypes) {
                return undefined;
            }

            // Check if the 'class' property exists in apexClassesSortedByTypes
            if (!apexClassesSortedByTypes.class) {
                return undefined;
            }

            // Get the names of all classes in the ApexSortedByType
            let apexClassNames = apexClassesSortedByTypes.class.map((cls) => cls.name);
            let interfaces = apexClassesSortedByTypes.interface.map((cls) => cls.name);
            const apexTestClassNames = apexClassesSortedByTypes.testClass.map((cls) => cls.name);
            apexClassNames = apexClassNames.filter((name) => !apexTestClassNames.includes(name));
            apexClassNames = apexClassNames.filter((name) => !interfaces.includes(name));

            // Filter changedComponents based on class names in ApexSortedByType and type === 'ApexClass'
            const filteredComponents = changedComponents.filter(
                (component) => apexClassNames.includes(component.fullName) && component.type === 'ApexClass'
            );

            // Extract the fullName property from the filtered components
            const filteredChangedClasses = filteredComponents.map((component) => component.fullName);

            return filteredChangedClasses;
        }
    }
}
