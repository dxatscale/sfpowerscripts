import BatchingTopoSort from './BatchingTopoSort';
import DependencyHelper from './DependencyHelper';
import Bottleneck from 'bottleneck';
import PackageDiffImpl, { PackageDiffOptions } from '@dxatscale/sfpowerscripts.core/lib/package/PackageDiffImpl';
import simplegit from 'simple-git';
import IncrementProjectBuildNumberImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/IncrementProjectBuildNumberImpl';
import { EOL } from 'os';
import SFPStatsSender from '@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender';
import { Stage } from '../Stage';
import * as fs from 'fs-extra';
import ProjectConfig from '@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig';
import BuildCollections from './BuildCollections';
const Table = require('cli-table');
import SFPLogger, {
    ConsoleLogger,
    FileLogger,
    LoggerLevel,
    VoidLogger,
} from '@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger';
import { COLOR_KEY_MESSAGE } from '@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger';
import { COLOR_HEADER } from '@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger';
import { COLOR_ERROR } from '@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger';
import SfpPackage, { PackageType } from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackage';
import SfpPackageBuilder from '@dxatscale/sfpowerscripts.core/lib/package/SfpPackageBuilder';
import getFormattedTime from '@dxatscale/sfpowerscripts.core/lib/utils/GetFormattedTime';
import { DEFAULT_LEFT_PADDING, ZERO_BORDER_TABLE } from '../../ui/TableConstants';
import PackageDependencyResolver from './PackageDependencyResolver';
import SFPOrg from '@dxatscale/sfpowerscripts.core/lib/org/SFPOrg';

const PRIORITY_UNLOCKED_PKG_WITH_DEPENDENCY = 1;
const PRIORITY_UNLOCKED_PKG_WITHOUT_DEPENDENCY = 3;
const PRIORITY_SOURCE_PKG = 5;
const PRIORITY_DATA_PKG = 5;

export interface BuildProps {
    configFilePath?: string;
    projectDirectory?: string;
    devhubAlias?: string;
    repourl?: string;
    waitTime: number;
    isQuickBuild: boolean;
    isDiffCheckEnabled: boolean;
    buildNumber: number;
    executorcount: number;
    isBuildAllAsSourcePackages: boolean;
    branch?: string;
    packagesToCommits?: { [p: string]: string };
    currentStage: Stage;
    baseBranch?: string;
    diffOptions?: PackageDiffOptions;
}
export default class BuildImpl {
    private limiter: Bottleneck;
    private parentsToBeFulfilled;
    private childs;
    private packagesToBeBuilt: string[];
    private packageCreationPromises: Array<Promise<SfpPackage>>;
    private projectConfig;
    private parents: any;
    private packagesInQueue: string[];
    private packagesBuilt: string[];
    private failedPackages: string[];
    private generatedPackages: SfpPackage[];
    private sfpOrg: SFPOrg;

    private repository_url: string;
    private commit_id: string;

    private recursiveAll = (a) => Promise.all(a).then((r) => (r.length == a.length ? r : this.recursiveAll(a)));

    public constructor(private props: BuildProps) {
        this.limiter = new Bottleneck({
            maxConcurrent: this.props.executorcount,
        });

        this.packagesBuilt = [];
        this.failedPackages = [];
        this.generatedPackages = [];
        this.packageCreationPromises = new Array();
    }

    public async exec(): Promise<{
        generatedPackages: SfpPackage[];
        failedPackages: string[];
    }> {
        if (this.props.devhubAlias) this.sfpOrg = await SFPOrg.create({ aliasOrUsername: this.props.devhubAlias });

        SFPLogger.log(`Invoking build...`, LoggerLevel.INFO);
        const git = simplegit();
        if (this.props.repourl == null) {
            this.repository_url = (await git.getConfig('remote.origin.url')).value;
            SFPLogger.log(`Fetched Remote URL ${this.repository_url}`, LoggerLevel.INFO);
        } else this.repository_url = this.props.repourl;

        if (!this.repository_url) throw new Error('Remote origin must be set in repository');

        this.commit_id = await git.revparse(['HEAD']);

        this.packagesToBeBuilt = this.getAllPackages(this.props.projectDirectory);

        // Read Manifest
        this.projectConfig = ProjectConfig.getSFDXProjectConfig(this.props.projectDirectory);

        //Do a diff Impl
        let table;
        if (this.props.isDiffCheckEnabled) {
            let packagesToBeBuiltWithReasons = await this.getListOfOnlyChangedPackages(
                this.props.projectDirectory,
                this.packagesToBeBuilt
            );
            table = this.createDiffPackageScheduledDisplayedAsATable(packagesToBeBuiltWithReasons);
            this.packagesToBeBuilt = Array.from(packagesToBeBuiltWithReasons.keys()); //Assign it back to the instance variable
        } else {
            table = this.createAllPackageScheduledDisplayedAsATable();
        }
        //Log Packages to be built
        console.log(COLOR_KEY_MESSAGE('Packages scheduled for build'));
        console.log(table.toString());

        for await (const pkg of this.packagesToBeBuilt) {
            let type = this.getPriorityandTypeOfAPackage(this.projectConfig, pkg).type;
            SFPStatsSender.logCount('build.scheduled.packages', {
                package: pkg,
                type: type,
                is_diffcheck_enabled: String(this.props.isDiffCheckEnabled),
                is_dependency_validated: this.props.isQuickBuild ? 'false' : 'true',
                pr_mode: String(this.props.isBuildAllAsSourcePackages),
            });
        }

        if (this.packagesToBeBuilt.length == 0)
            return {
                generatedPackages: this.generatedPackages,
                failedPackages: this.failedPackages,
            };

        this.childs = DependencyHelper.getChildsOfAllPackages(this.props.projectDirectory, this.packagesToBeBuilt);

        this.parents = DependencyHelper.getParentsOfAllPackages(this.props.projectDirectory, this.packagesToBeBuilt);

        this.parentsToBeFulfilled = DependencyHelper.getParentsToBeFullFilled(this.parents, this.packagesToBeBuilt);

        let sortedBatch = new BatchingTopoSort().sort(this.childs);

        if (!this.props.isQuickBuild && this.sfpOrg) {
            const packageDependencyResolver = new PackageDependencyResolver(
                this.sfpOrg.getConnection(),
                this.projectConfig,
                this.packagesToBeBuilt
            );
            this.projectConfig = await packageDependencyResolver.resolvePackageDependencyVersions();
        }

        //Do First Level Package First
        let pushedPackages = [];
        for (const pkg of sortedBatch[0]) {
            let { priority, type } = this.getPriorityandTypeOfAPackage(this.projectConfig, pkg);
            let packagePromise: Promise<SfpPackage> = this.limiter
                .schedule({ id: pkg, priority: priority }, () =>
                    this.createPackage(type, pkg, this.props.isBuildAllAsSourcePackages)
                )
                .then(
                    (sfpPackage: SfpPackage) => {
                        this.generatedPackages.push(sfpPackage);
                        SFPStatsSender.logCount('build.succeeded.packages', {
                            package: pkg,
                            type: type,
                            is_diffcheck_enabled: String(this.props.isDiffCheckEnabled),
                            is_dependency_validated: this.props.isQuickBuild ? 'false' : 'true',
                            pr_mode: String(this.props.isBuildAllAsSourcePackages),
                        });
                        this.queueChildPackages(sfpPackage);
                    },
                    (reason: any) => this.handlePackageError(reason, pkg)
                );

            pushedPackages.push(pkg);
            this.packageCreationPromises.push(packagePromise);
        }

        //Remove Pushed Packages from the packages array
        this.packagesToBeBuilt = this.packagesToBeBuilt.filter((el) => {
            return !pushedPackages.includes(el);
        });

        this.packagesInQueue = Array.from(pushedPackages);

        this.printQueueDetails();

        //Other packages get added when each one in the first level finishes
        await this.recursiveAll(this.packageCreationPromises);

        return {
            generatedPackages: this.generatedPackages,
            failedPackages: this.failedPackages,
        };
    }

    private createDiffPackageScheduledDisplayedAsATable(packagesToBeBuilt: Map<string, any>) {
        let table = new Table({
            head: ['Package', 'Reason to be built', 'Last Known Tag'],
        });
        for (const pkg of packagesToBeBuilt.keys()) {
            let item = [
                pkg,
                packagesToBeBuilt.get(pkg).reason,
                packagesToBeBuilt.get(pkg).tag ? packagesToBeBuilt.get(pkg).tag : '',
            ];
            table.push(item);
        }
        return table;
    }

    private createAllPackageScheduledDisplayedAsATable() {
        let table = new Table({
            head: ['Package', 'Reason to be built'],
        });
        for (const pkg of this.packagesToBeBuilt) {
            let item = [pkg, 'Activated as part of all package build'];
            table.push(item);
        }
        return table;
    }

    private async getListOfOnlyChangedPackages(projectDirectory: string, allPackagesInRepo: any) {
        let packagesToBeBuilt = new Map<string, any>();
        let buildCollections = new BuildCollections(projectDirectory);

        for await (const pkg of allPackagesInRepo) {
            let diffImpl: PackageDiffImpl = new PackageDiffImpl(
                new ConsoleLogger(),
                pkg,
                this.props.projectDirectory,
                this.props.packagesToCommits,
                this.getPathToForceIgnoreForCurrentStage(this.projectConfig, this.props.currentStage),
                this.props.diffOptions
            );
            let packageDiffCheck = await diffImpl.exec();

            if (packageDiffCheck.isToBeBuilt) {
                packagesToBeBuilt.set(pkg, { reason: packageDiffCheck.reason, tag: packageDiffCheck.tag });
                //Add Bundles
                if (buildCollections.isPackageInACollection(pkg)) {
                    buildCollections.listPackagesInCollection(pkg).forEach((packageInCollection) => {
                        if (!packagesToBeBuilt.has(packageInCollection)) {
                            packagesToBeBuilt.set(packageInCollection, { reason: 'Part of a build collection' });
                        }
                    });
                }
            }
        }
        return packagesToBeBuilt;
    }


    private getAllPackages(projectDirectory: string): string[] {
        let projectConfig = ProjectConfig.getSFDXProjectConfig(projectDirectory);
        let sfdxpackages = [];

        let packageDescriptors = projectConfig['packageDirectories'].filter((pkg) => {
            if (
                pkg.ignoreOnStage?.find((stage) => {
                    stage = stage.toLowerCase();
                    return stage === this.props.currentStage;
                })
            )
                return false;
            else return true;
        });

        // Ignore aliasfied packages on validate & prepare stages
        packageDescriptors = packageDescriptors.filter((pkg) => {
            return !(
                (this.props.currentStage === 'prepare' || this.props.currentStage === 'validate') &&
                pkg.aliasfy &&
                pkg.type !== PackageType.Data
            );
        });

        for (const pkg of packageDescriptors) {
            if (pkg.package && pkg.versionNumber) sfdxpackages.push(pkg['package']);
        }
        return sfdxpackages;
    }

    private printQueueDetails() {
        console.log(`${EOL}Packages currently processed:{${this.packagesInQueue.length}} `, `${this.packagesInQueue}`);
        console.log(
            `Awaiting Dependencies to be resolved:{${this.packagesToBeBuilt.length}} `,
            `${this.packagesToBeBuilt}`
        );
    }

    private handlePackageError(reason: any, pkg: string): any {
        console.log(COLOR_HEADER(`${EOL}-----------------------------------------`));
        console.log(COLOR_ERROR(`Package Creation Failed for ${pkg}`));
        try {
            // Append error to log file
            fs.appendFileSync(`.sfpowerscripts/logs/${pkg}`, reason.message, 'utf8');

            let data = fs.readFileSync(`.sfpowerscripts/logs/${pkg}`, 'utf8');
            console.log(data);
        } catch (e) {
            console.log(`Unable to display logs for pkg ${pkg}`);
        }

        //Remove the package from packages To Be Built
        this.packagesToBeBuilt = this.packagesToBeBuilt.filter((el) => {
            if (el == pkg) return false;
            else return true;
        });
        this.packagesInQueue = this.packagesInQueue.filter((pkg_name) => {
            if (pkg == pkg_name) return false;
            else return true;
        });

        //Remove myself and my  childs
        this.failedPackages.push(pkg);
        SFPStatsSender.logCount('build.failed.packages', { package: pkg });
        this.packagesToBeBuilt = this.packagesToBeBuilt.filter((pkg) => {
            if (this.childs[pkg].includes(pkg)) {
                this.childs[pkg].forEach((removedChilds) => {
                    SFPStatsSender.logCount('build.failed.packages', {
                        package: removedChilds,
                    });
                });
                this.failedPackages.push(this.childs[pkg]);
                return false;
            }
        });
        console.log(COLOR_KEY_MESSAGE(`${EOL}Removed all childs of ${pkg} from queue`));
        console.log(COLOR_HEADER(`${EOL}-----------------------------------------`));
    }

    private queueChildPackages(sfpPackage: SfpPackage): any {
        this.packagesBuilt.push(sfpPackage.packageName);
        this.printPackageDetails(sfpPackage);

        this.packagesToBeBuilt.forEach((pkg) => {
            const indexOfFulfilledParent = this.parentsToBeFulfilled[pkg]?.findIndex(
                (parent) => parent === sfpPackage.packageName
            );
            if (indexOfFulfilledParent !== -1 && indexOfFulfilledParent != null) {
                if (!this.props.isQuickBuild) this.resolveDependenciesOnCompletedPackage(pkg, sfpPackage);

                //let all my childs know, I am done building  and remove myself from
                this.parentsToBeFulfilled[pkg].splice(indexOfFulfilledParent, 1);
            }
        });

        // Do a second pass and push packages with fulfilled parents to queue
        let pushedPackages = [];
        this.packagesToBeBuilt.forEach((pkg) => {
            if (this.parentsToBeFulfilled[pkg]?.length == 0) {
                let { priority, type } = this.getPriorityandTypeOfAPackage(this.projectConfig, pkg);
                let packagePromise: Promise<SfpPackage> = this.limiter
                    .schedule({ id: pkg, priority: priority }, () =>
                        this.createPackage(type, pkg, this.props.isBuildAllAsSourcePackages)
                    )
                    .then(
                        (sfpPackage: SfpPackage) => {
                            SFPStatsSender.logCount('build.succeeded.packages', {
                                package: pkg,
                                type: type,
                                is_diffcheck_enabled: String(this.props.isDiffCheckEnabled),
                                is_dependency_validated: this.props.isQuickBuild ? 'false' : 'true',
                                pr_mode: String(this.props.isBuildAllAsSourcePackages),
                            });
                            this.generatedPackages.push(sfpPackage);
                            this.queueChildPackages(sfpPackage);
                        },
                        (reason: any) => this.handlePackageError(reason, pkg)
                    );
                pushedPackages.push(pkg);
                this.packagesInQueue.push(pkg);
                this.packageCreationPromises.push(packagePromise);
            }
        });

        if (pushedPackages.length > 0) {
            console.log(
                COLOR_KEY_MESSAGE(
                    `${EOL}Packages being pushed to the queue:{${pushedPackages.length}} `,
                    `${pushedPackages}`
                )
            );
        }
        //Remove Pushed Packages from the packages array
        this.packagesToBeBuilt = this.packagesToBeBuilt.filter((el) => {
            return !pushedPackages.includes(el);
        });
        this.packagesInQueue = this.packagesInQueue.filter((pkg_name) => pkg_name !== sfpPackage.packageName);

        this.printQueueDetails();
    }

    private resolveDependenciesOnCompletedPackage(dependentPackage: string, completedPackage: SfpPackage) {
        const pkgDescriptor = ProjectConfig.getPackageDescriptorFromConfig(dependentPackage, this.projectConfig);
        const dependency = pkgDescriptor.dependencies.find(
            (dependency) => dependency.package === completedPackage.packageName
        );
        dependency.versionNumber = completedPackage.versionNumber;
    }

    private getPriorityandTypeOfAPackage(projectConfig: any, pkg: string) {
        let priority = 0;
        let childs = DependencyHelper.getChildsOfAllPackages(this.props.projectDirectory, this.packagesToBeBuilt);
        let type = ProjectConfig.getPackageType(projectConfig, pkg);
        if (type === PackageType.Unlocked) {
            if (childs[pkg].length > 0) priority = PRIORITY_UNLOCKED_PKG_WITH_DEPENDENCY;
            else priority = PRIORITY_UNLOCKED_PKG_WITHOUT_DEPENDENCY;
        } else if (type === PackageType.Source) {
            priority = PRIORITY_SOURCE_PKG;
        } else if (type === PackageType.Data) {
            priority = PRIORITY_DATA_PKG;
        } else {
            throw new Error(`Unknown package type ${type}`);
        }

        return { priority, type };
    }

    private printPackageDetails(sfpPackage: SfpPackage) {
        SFPLogger.log(
            COLOR_HEADER(
                `${EOL}${sfpPackage.packageName} package created in ${getFormattedTime(
                    sfpPackage.creation_details.creation_time
                )}`
            )
        );

        SFPLogger.log(COLOR_HEADER(`-- Package Details:--`));
        const table = new Table({
            chars: ZERO_BORDER_TABLE,
            style: DEFAULT_LEFT_PADDING,
        });
        table.push([COLOR_HEADER(`Package Type`), COLOR_KEY_MESSAGE(sfpPackage.package_type)]);
        table.push([COLOR_HEADER(`Package Version Number`), COLOR_KEY_MESSAGE(sfpPackage.package_version_number)]);

        if (sfpPackage.package_type !== PackageType.Data) {
            if (sfpPackage.package_type == PackageType.Unlocked) {
                if (sfpPackage.package_version_id)
                    table.push([COLOR_HEADER(`Package Version Id`), COLOR_KEY_MESSAGE(sfpPackage.package_version_id)]);
                if (sfpPackage.test_coverage)
                    table.push([COLOR_HEADER(`Package Test Coverage`), COLOR_KEY_MESSAGE(sfpPackage.test_coverage)]);
                if (sfpPackage.has_passed_coverage_check)
                    table.push([
                        COLOR_HEADER(`Package Coverage Check Passed`),
                        COLOR_KEY_MESSAGE(sfpPackage.has_passed_coverage_check),
                    ]);
            }

            table.push([COLOR_HEADER(`Metadata Count`), COLOR_KEY_MESSAGE(sfpPackage.metadataCount)]);
            table.push([COLOR_HEADER(`Apex In Package`), COLOR_KEY_MESSAGE(sfpPackage.isApexFound ? 'Yes' : 'No')]);
            table.push([
                COLOR_HEADER(`Profiles In Package`),
                COLOR_KEY_MESSAGE(sfpPackage.isProfilesFound ? 'Yes' : 'No'),
            ]);

            if (sfpPackage.diffPackageMetadata) {
                table.push([COLOR_HEADER(`Source Version From`), COLOR_KEY_MESSAGE(sfpPackage.diffPackageMetadata.sourceVersionFrom)]);
                table.push([COLOR_HEADER(`Source Version From`), COLOR_KEY_MESSAGE(sfpPackage.diffPackageMetadata.sourceVersionTo)]);
                table.push([
                    COLOR_HEADER(`Metadata Count for Diff Package`),
                    COLOR_KEY_MESSAGE(sfpPackage.diffPackageMetadata.metadataCount),
                ]);
                table.push([
                    COLOR_HEADER(`Metadata Count for Diff Package`),
                    COLOR_KEY_MESSAGE(sfpPackage.diffPackageMetadata.invalidatedTestClasses?.length),
                ]);
            }
            SFPLogger.log(table.toString());

            const packageDependencies = this.projectConfig.packageDirectories.find(
                (dir) => dir.package === sfpPackage.package_name
            ).dependencies;
            if (packageDependencies && Array.isArray(packageDependencies) && packageDependencies.length > 0) {
                SFPLogger.log(COLOR_HEADER(`   Resolved package dependencies:`));
                this.printPackageDependencies(packageDependencies);
            }
        }
    }

    private printPackageDependencies(dependencies: { package: string; versionNumber?: string }[]) {
        const table = new Table({
            head: ['Package', 'Version'],
            chars: ZERO_BORDER_TABLE,
            style: DEFAULT_LEFT_PADDING,
        });

        for (const dependency of dependencies) {
            let versionNumber = 'N/A';

            if (!dependency.versionNumber)
                versionNumber = this.projectConfig.packageAliases[dependency.package]
                    ? this.projectConfig.packageAliases[dependency.package]
                    : 'N/A';
            else versionNumber = dependency.versionNumber;

            const row = [dependency.package, versionNumber];
            table.push(row);
        }
        SFPLogger.log(table.toString());
    }

    private async createPackage(
        packageType: string,
        sfdx_package: string,
        isValidateMode: boolean
    ): Promise<SfpPackage> {
        console.log(COLOR_KEY_MESSAGE(`Package creation initiated for  ${sfdx_package}`));

        return SfpPackageBuilder.buildPackageFromProjectDirectory(
            new FileLogger(`.sfpowerscripts/logs/${sfdx_package}`),
            this.props.projectDirectory,
            sfdx_package,
            {
                overridePackageTypeWith:
                    isValidateMode && packageType != PackageType.Data ? PackageType.Source : undefined,
                packageVersionNumber: this.getVersionNumber(sfdx_package, packageType, isValidateMode),
                branch: this.props.branch,
                sourceVersion: this.commit_id,
                repositoryUrl: this.repository_url,
                configFilePath: this.props.configFilePath,
                pathToReplacementForceIgnore: this.getPathToForceIgnoreForCurrentStage(
                    this.projectConfig,
                    this.props.currentStage
                ),
                revisionFrom:
                    this.props.packagesToCommits && this.props.packagesToCommits[sfdx_package]
                        ? this.props.packagesToCommits[sfdx_package]
                        : null,
                revisionTo: this.props.packagesToCommits && this.props.packagesToCommits[sfdx_package] ? 'HEAD' : null,
            },
            {
                devHub: this.props.devhubAlias,
                installationkeybypass: true,
                installationkey: undefined,
                waitTime: this.props.waitTime.toString(),
                isCoverageEnabled: !this.props.isQuickBuild,
                isSkipValidation: this.props.isQuickBuild,
                breakBuildIfEmpty: true,
                baseBranch: this.props.baseBranch,
            },
            this.projectConfig
        );
    }

    /**
     * Get the file path of the forceignore for current stage, from project config.
     * Returns null if a forceignore path is not defined in the project config for the current stage.
     *
     * @param projectConfig
     * @param currentStage
     */
    private getPathToForceIgnoreForCurrentStage(projectConfig: any, currentStage: Stage): string {
        let stageForceIgnorePath: string;

        let ignoreFiles: { [key in Stage]: string } = projectConfig.plugins?.sfpowerscripts?.ignoreFiles;
        if (ignoreFiles) {
            Object.keys(ignoreFiles).forEach((key) => {
                if (key.toLowerCase() == currentStage) {
                    stageForceIgnorePath = ignoreFiles[key];
                }
            });
        }

        if (stageForceIgnorePath) {
            if (fs.existsSync(stageForceIgnorePath)) {
                return stageForceIgnorePath;
            } else throw new Error(`${stageForceIgnorePath} forceignore file does not exist`);
        } else return null;
    }

    private getVersionNumber(sfdx_package: string, packageType: string, isValidateMode: boolean): string {
        let incrementedVersionNumber;
        if (isValidateMode || packageType != PackageType.Unlocked) {
            if (this.props.buildNumber) {
                let incrementBuildNumber = new IncrementProjectBuildNumberImpl(
                    new VoidLogger(),
                    this.props.projectDirectory,
                    sfdx_package,
                    'BuildNumber',
                    true,
                    this.props.buildNumber.toString()
                );
                incrementedVersionNumber = incrementBuildNumber.exec();
            }
        }

        if (isValidateMode) return incrementedVersionNumber?.versionNumber;
        else return packageType !== PackageType.Unlocked ? incrementedVersionNumber?.versionNumber : undefined;
    }
}
