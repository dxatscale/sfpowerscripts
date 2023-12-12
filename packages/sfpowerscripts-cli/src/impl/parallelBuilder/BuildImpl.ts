import BatchingTopoSort from "./BatchingTopoSort";
import DependencyHelper from "./DependencyHelper";
import Bottleneck from "bottleneck";
import PackageDiffImpl, {
	PackageDiffOptions,
} from "@dxatscale/sfpowerscripts.core/lib/package/diff/PackageDiffImpl";
import { EOL } from "os";
import SFPStatsSender from "@dxatscale/sfpowerscripts.core/lib/stats/SFPStatsSender";
import { Stage } from "../Stage";
import * as fs from "fs-extra";
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";
import BuildCollections from "./BuildCollections";
const Table = require("cli-table");
import SFPLogger, {
	COLOR_KEY_VALUE,
	ConsoleLogger,
	FileLogger,
	LoggerLevel,
	VoidLogger,
} from "@dxatscale/sfp-logger";
import { COLOR_KEY_MESSAGE } from "@dxatscale/sfp-logger";
import { COLOR_HEADER } from "@dxatscale/sfp-logger";
import { COLOR_ERROR } from "@dxatscale/sfp-logger";
import SfpPackage, {
	PackageType,
} from "@dxatscale/sfpowerscripts.core/lib/package/SfpPackage";
import SfpPackageBuilder from "@dxatscale/sfpowerscripts.core/lib/package/SfpPackageBuilder";
import getFormattedTime from "@dxatscale/sfpowerscripts.core/lib/utils/GetFormattedTime";
import {
	COLON_MIDDLE_BORDER_TABLE,
	ZERO_BORDER_TABLE,
} from "../../ui/TableConstants";
import PackageDependencyResolver from "@dxatscale/sfpowerscripts.core/lib/package/dependencies/PackageDependencyResolver";
import SFPOrg from "@dxatscale/sfpowerscripts.core/lib/org/SFPOrg";
import Git from "@dxatscale/sfpowerscripts.core/lib/git/Git";
import TransitiveDependencyResolver from "@dxatscale/sfpowerscripts.core/lib/package/dependencies/TransitiveDependencyResolver";
import GroupConsoleLogs from "../../ui/GroupConsoleLogs";
import UserDefinedExternalDependency from "@dxatscale/sfpowerscripts.core/lib/project/UserDefinedExternalDependency";
import PackageDependencyDisplayer from "@dxatscale/sfpowerscripts.core/lib/display/PackageDependencyDisplayer";
import { BuildStreamService } from '@dxatscale/sfpowerscripts.core/lib/eventStream/build';

const PRIORITY_UNLOCKED_PKG_WITH_DEPENDENCY = 1;
const PRIORITY_UNLOCKED_PKG_WITHOUT_DEPENDENCY = 3;
const PRIORITY_SOURCE_PKG = 5;
const PRIORITY_DATA_PKG = 5;

export interface BuildProps {
	overridePackageTypes?: { [key: string]: PackageType };
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
	jobId?: string;
	branch?: string;
	currentStage: Stage;
	baseBranch?: string;
	diffOptions?: PackageDiffOptions;
	includeOnlyPackages?: string[];
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
	private scratchOrgDefinitions: { [key: string]: any }[];
	private isMultiConfigFilesEnabled: boolean;

	private repository_url: string;
	private commit_id: string;

	private logger = new ConsoleLogger();
	private recursiveAll = (a) =>
		Promise.all(a).then((r) =>
			r.length == a.length ? r : this.recursiveAll(a),
		);

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
		if (this.props.devhubAlias)
			this.sfpOrg = await SFPOrg.create({
				aliasOrUsername: this.props.devhubAlias,
			});

		BuildStreamService.buildProps(this.props);
		let git = await Git.initiateRepo(new ConsoleLogger());
		this.repository_url = await git.getRemoteOriginUrl(this.props.repourl);
		this.commit_id = await git.getHeadCommit();
        BuildStreamService.buildJobAndOrgId(this.props.jobId, this.sfpOrg?.getConnection().getAuthInfoFields().instanceUrl,this.props.devhubAlias,this.commit_id);
		this.packagesToBeBuilt = this.getPackagesToBeBuilt(
			this.props.projectDirectory,
			this.props.includeOnlyPackages,
		);

		// Read Manifest
		this.projectConfig = ProjectConfig.getSFDXProjectConfig(
			this.props.projectDirectory,
		);

		//Build Scratch Org Def Files Map
		this.scratchOrgDefinitions = this.getMultiScratchOrgDefinitionFileMap(
			this.projectConfig,
		);

		//Do a diff Impl
		let table;
		if (this.props.isDiffCheckEnabled) {
			let packagesToBeBuiltWithReasons =
				await this.filterPackagesToBeBuiltByChanged(
					this.props.projectDirectory,
					this.packagesToBeBuilt,
				);
			table = this.createDiffPackageScheduledDisplayedAsATable(
				packagesToBeBuiltWithReasons,
			);
			this.packagesToBeBuilt = Array.from(packagesToBeBuiltWithReasons.keys()); //Assign it back to the instance variable
		} else {
			table = this.createAllPackageScheduledDisplayedAsATable();
		}
		//Log Packages to be built
		SFPLogger.log(COLOR_KEY_MESSAGE("Packages scheduled for build"));
		SFPLogger.log(table.toString());

		//Fix transitive dependency gap
		let groupDependencyResolutionLogs = new GroupConsoleLogs(
			"Resolving dependencies",
			this.logger,
		).begin();
		this.projectConfig = await this.resolvePackageDependencies(
			this.projectConfig,
		);
		groupDependencyResolutionLogs.end();

		let buildPackagesLogs = new GroupConsoleLogs(
			"Building Packages",
			this.logger,
		).begin();

		for await (const pkg of this.packagesToBeBuilt) {
			let type = this.getPriorityandTypeOfAPackage(
				this.projectConfig,
				pkg,
			).type;
			SFPStatsSender.logCount("build.scheduled.packages", {
				package: pkg,
				type: type,
				is_diffcheck_enabled: String(this.props.isDiffCheckEnabled),
				is_dependency_validated: this.props.isQuickBuild ? "false" : "true",
				pr_mode: String(this.props.isBuildAllAsSourcePackages),
			});
		}

		if (this.packagesToBeBuilt.length == 0)
			return {
				generatedPackages: this.generatedPackages,
				failedPackages: this.failedPackages,
			};

		this.childs = DependencyHelper.getChildsOfAllPackages(
			this.props.projectDirectory,
			this.packagesToBeBuilt,
		);

		this.parents = DependencyHelper.getParentsOfAllPackages(
			this.props.projectDirectory,
			this.packagesToBeBuilt,
		);

		this.parentsToBeFulfilled = DependencyHelper.getParentsToBeFullFilled(
			this.parents,
			this.packagesToBeBuilt,
		);

		let sortedBatch = new BatchingTopoSort().sort(this.childs);

		if (!this.props.isQuickBuild && this.sfpOrg) {
			const packageDependencyResolver = new PackageDependencyResolver(
				this.sfpOrg.getConnection(),
				this.projectConfig,
				this.packagesToBeBuilt,
			);
			this.projectConfig =
				await packageDependencyResolver.resolvePackageDependencyVersions();
		}

		//Do First Level Package First
		let pushedPackages = [];
		for (const pkg of sortedBatch[0]) {
			let { priority, type } = this.getPriorityandTypeOfAPackage(
				this.projectConfig,
				pkg,
			);
			let packagePromise: Promise<SfpPackage> = this.limiter
				.schedule({ id: pkg, priority: priority }, () =>
					this.createPackage(type, pkg, this.props.isBuildAllAsSourcePackages),
				)
				.then(
					(sfpPackage: SfpPackage) => {
						this.generatedPackages.push(sfpPackage);
						SFPStatsSender.logCount("build.succeeded.packages", {
							package: pkg,
							type: type,
							is_diffcheck_enabled: String(this.props.isDiffCheckEnabled),
							is_dependency_validated: this.props.isQuickBuild
								? "false"
								: "true",
							pr_mode: String(this.props.isBuildAllAsSourcePackages),
						});
						this.queueChildPackages(sfpPackage);
					},
					(reason: any) => this.handlePackageError(reason, pkg),
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

		buildPackagesLogs.end();

		return {
			generatedPackages: this.generatedPackages,
			failedPackages: this.failedPackages,
		};
	}

	private createDiffPackageScheduledDisplayedAsATable(
		packagesToBeBuilt: Map<string, any>,
	) {
		let tableHead = ["Package", "Reason to be built", "Last Known Tag"];
		if (
			this.isMultiConfigFilesEnabled &&
			this.props.currentStage == Stage.BUILD
		) {
			tableHead.push("Scratch Org Config File");
		}
		let table = new Table({
			head: tableHead,
			chars: ZERO_BORDER_TABLE,
		});
		for (const pkg of packagesToBeBuilt.keys()) {
			let item = [
				pkg,
				packagesToBeBuilt.get(pkg).reason,
				packagesToBeBuilt.get(pkg).tag ? packagesToBeBuilt.get(pkg).tag : "",
			];
			if (
				this.isMultiConfigFilesEnabled &&
				this.props.currentStage == Stage.BUILD
			) {
				item.push(
					this.scratchOrgDefinitions[pkg]
						? this.scratchOrgDefinitions[pkg]
						: this.props.configFilePath,
				);
			}

			table.push(item);
		}
		return table;
	}

	private createAllPackageScheduledDisplayedAsATable() {
		let tableHead = ["Package", "Reason to be built"];
		if (
			this.isMultiConfigFilesEnabled &&
			this.props.currentStage == Stage.BUILD
		) {
			tableHead.push("Scratch Org Config File");
		}
		let table = new Table({
			head: tableHead,
			chars: ZERO_BORDER_TABLE,
		});
		for (const pkg of this.packagesToBeBuilt) {
			let item = [pkg, "Activated as part of all package build"];
			BuildStreamService.buildPackageInitialitation(pkg,'Activated as part of all package build','');
			if (
				this.isMultiConfigFilesEnabled &&
				this.props.currentStage == Stage.BUILD
			) {
				item.push(
					this.scratchOrgDefinitions[pkg]
						? this.scratchOrgDefinitions[pkg]
						: this.props.configFilePath,
				);
			}
			table.push(item);
		}
		return table;
	}

	private async filterPackagesToBeBuiltByChanged(
		projectDirectory: string,
		allPackagesInRepo: any,
	) {
		let packagesToBeBuilt = new Map<string, any>();
		let buildCollections = new BuildCollections(projectDirectory);
		if (this.props.diffOptions)
			this.props.diffOptions.pathToReplacementForceIgnore =
				this.getPathToForceIgnoreForCurrentStage(
					this.projectConfig,
					this.props.currentStage,
				);

		for await (const pkg of allPackagesInRepo) {
			let diffImpl: PackageDiffImpl = new PackageDiffImpl(
				new ConsoleLogger(),
				pkg,
				this.props.projectDirectory,
				this.props.diffOptions,
			);
			let packageDiffCheck = await diffImpl.exec();

			if (packageDiffCheck.isToBeBuilt) {
				packagesToBeBuilt.set(pkg, {
					reason: packageDiffCheck.reason,
					tag: packageDiffCheck.tag,
				});
				BuildStreamService.buildPackageInitialitation(pkg,packageDiffCheck.reason,packageDiffCheck.tag);
				//Add Bundles
				if (buildCollections.isPackageInACollection(pkg)) {
					buildCollections
						.listPackagesInCollection(pkg)
						.forEach((packageInCollection) => {
							if (!packagesToBeBuilt.has(packageInCollection)) {
								packagesToBeBuilt.set(packageInCollection, {
									reason: "Part of a build collection",
								});
								BuildStreamService.buildPackageInitialitation(packageInCollection,'Part of a build collection','');
							}
						});
				}
			}
		}
		return packagesToBeBuilt;
	}

	private getPackagesToBeBuilt(
		projectDirectory: string,
		includeOnlyPackages?: string[],
	): string[] {
		let projectConfig = ProjectConfig.getSFDXProjectConfig(projectDirectory);
		let sfdxpackages = [];

		let packageDescriptors = projectConfig["packageDirectories"].filter(
			(pkg) => {
				if (
					pkg.ignoreOnStage?.find((stage) => {
						stage = stage.toLowerCase();
						return stage === this.props.currentStage;
					})
				)
					return false;
				else return true;
			},
		);

		//Filter Packages
		if (includeOnlyPackages) {
			//Display include only packages
			printIncludeOnlyPackages();
			packageDescriptors = packageDescriptors.filter((pkg) => {
				if (
					includeOnlyPackages.find((includedPkg) => {
						return includedPkg == pkg.package;
					})
				)
					return true;
				else return false;
			});
		}

		//       Ignore aliasfied packages on  stages fix #1289
		packageDescriptors = packageDescriptors.filter((pkg) => {
			return !(
				this.props.currentStage === "prepare" &&
				pkg.aliasfy &&
				pkg.type !== PackageType.Data
			);
		});

		for (const pkg of packageDescriptors) {
			if (pkg.package && pkg.versionNumber) sfdxpackages.push(pkg["package"]);
		}
		return sfdxpackages;

		function printIncludeOnlyPackages() {
			SFPLogger.log(
				COLOR_KEY_MESSAGE(
					`Build will include the below packages as per inclusive filter`,
				),
				LoggerLevel.TRACE,
			);
			SFPLogger.log(
				COLOR_KEY_VALUE(`${includeOnlyPackages.toString()}`),
				LoggerLevel.TRACE,
			);
		}
	}

	private printQueueDetails() {
		SFPLogger.log(
			`${EOL}Packages currently processed:{${this.packagesInQueue.length}} + ${this.packagesInQueue}`,
		);
		BuildStreamService.buildPackageCurrentlyProcessedList(this.packagesInQueue);
		SFPLogger.log(
			`Awaiting Dependencies to be resolved:{${this.packagesToBeBuilt.length}} + ${this.packagesToBeBuilt}`,
		);
		BuildStreamService.buildPackageAwaitingList(this.packagesToBeBuilt);
	}

	private handlePackageError(reason: any, pkg: string): any {
		SFPLogger.printHeaderLine('', COLOR_HEADER, LoggerLevel.INFO);
		SFPLogger.log(COLOR_ERROR(`Package Creation Failed for ${pkg}, Here are the details:`));
		const sfpPackageMain:SfpPackage = {
			projectDirectory: this.props.projectDirectory, packageDirectory: pkg,
			workingDirectory: "",
			mdapiDir: "",
			destructiveChangesPath: "",
			resolvedPackageDirectory: "",
			version: "",
			packageName: "",
			versionNumber: "",
			packageType: "",
			toJSON() {
				return this;
			},
			package_name: pkg
		}; 

		BuildStreamService.sendPackageError(sfpPackageMain,reason.message);

		try {
			// Append error to log file
			fs.appendFileSync(`.sfpowerscripts/logs/${pkg}`, reason.message, "utf8");
			let data = fs.readFileSync(`.sfpowerscripts/logs/${pkg}`, "utf8");

			const pathToMarkDownFile = `.sfpowerscripts/outputs/build-error-info.md`;
			fs.mkdirpSync(".sfpowerscripts/outputs");
			fs.createFileSync(pathToMarkDownFile);
			fs.appendFileSync(pathToMarkDownFile, `\nPlease find the errors observed during build\n\n`);
			fs.appendFileSync(pathToMarkDownFile, `## ${pkg}\n\n`);
			fs.appendFileSync(pathToMarkDownFile, data);


			SFPLogger.log(data);
		} catch (e) {
			BuildStreamService.sendPackageError(sfpPackageMain,`Unable to display logs for pkg ${pkg}`);
			SFPLogger.log(`Unable to display logs for pkg ${pkg}`);
		}

		//Remove the package from packages To Be Built
		this.packagesToBeBuilt = this.packagesToBeBuilt.filter((el) => {
			if (el == pkg) return false;
			else return true;
		});
		BuildStreamService.buildPackageAwaitingList(this.packagesToBeBuilt);
		this.packagesInQueue = this.packagesInQueue.filter((pkg_name) => {
			if (pkg == pkg_name) return false;
			else return true;
		});
		BuildStreamService.buildPackageCurrentlyProcessedList(this.packagesInQueue);

		//Remove myself and my  childs
		this.failedPackages.push(pkg);
		BuildStreamService.buildPackageErrorList(pkg);
		SFPStatsSender.logCount("build.failed.packages", { package: pkg });
		this.packagesToBeBuilt = this.packagesToBeBuilt.filter((pkgBuild) => {
			if (this.childs[pkg].includes(pkgBuild)) {
				SFPStatsSender.logCount("build.failed.packages", {
					package: pkgBuild,
				});
				const sfpPackage:SfpPackage = {
					projectDirectory: this.props.projectDirectory, packageDirectory: pkgBuild,
					workingDirectory: "",
					mdapiDir: "",
					destructiveChangesPath: "",
					resolvedPackageDirectory: "",
					version: "",
					packageName: "",
					versionNumber: "",
					packageType: "",
					toJSON() {
						return this;
					},
					package_name: pkgBuild
				}; 
				BuildStreamService.sendPackageError(sfpPackage,reason.message);
				BuildStreamService.buildPackageErrorList(pkgBuild);
				this.failedPackages.push(pkgBuild);
				return false;
			}
			return true
		});
		SFPLogger.log(
			COLOR_KEY_MESSAGE(`${EOL}Removed all childs of ${pkg} from queue`),
		);
		SFPLogger.printHeaderLine('', COLOR_HEADER, LoggerLevel.INFO);
	}

	private queueChildPackages(sfpPackage: SfpPackage): any {
		this.packagesBuilt.push(sfpPackage.packageName);
		BuildStreamService.buildPackageSuccessList(sfpPackage.packageName);
		BuildStreamService.sendPackageCompletedInfos(sfpPackage);
		this.printPackageDetails(sfpPackage);

		this.packagesToBeBuilt.forEach((pkg) => {
			const indexOfFulfilledParent = this.parentsToBeFulfilled[pkg]?.findIndex(
				(parent) => parent === sfpPackage.packageName,
			);
			if (indexOfFulfilledParent !== -1 && indexOfFulfilledParent != null) {
				if (!this.props.isQuickBuild)
					this.resolveDependenciesOnCompletedPackage(pkg, sfpPackage);

				//let all my childs know, I am done building  and remove myself from
				this.parentsToBeFulfilled[pkg].splice(indexOfFulfilledParent, 1);
			}
		});

		// Do a second pass and push packages with fulfilled parents to queue
		let pushedPackages = [];
		this.packagesToBeBuilt.forEach((pkg) => {
			if (this.parentsToBeFulfilled[pkg]?.length == 0) {
				let { priority, type } = this.getPriorityandTypeOfAPackage(
					this.projectConfig,
					pkg,
				);
				let packagePromise: Promise<SfpPackage> = this.limiter
					.schedule({ id: pkg, priority: priority }, () =>
						this.createPackage(
							type,
							pkg,
							this.props.isBuildAllAsSourcePackages,
						),
					)
					.then(
						(sfpPackage: SfpPackage) => {
							SFPStatsSender.logCount("build.succeeded.packages", {
								package: pkg,
								type: type,
								is_diffcheck_enabled: String(this.props.isDiffCheckEnabled),
								is_dependency_validated: this.props.isQuickBuild
									? "false"
									: "true",
								pr_mode: String(this.props.isBuildAllAsSourcePackages),
							});
							this.generatedPackages.push(sfpPackage);
							this.queueChildPackages(sfpPackage);
						},
						(reason: any) => this.handlePackageError(reason, pkg),
					);
				pushedPackages.push(pkg);
				this.packagesInQueue.push(pkg);
				this.packageCreationPromises.push(packagePromise);
			}
		});

		if (pushedPackages.length > 0) {
			SFPLogger.log(
				COLOR_KEY_MESSAGE(
					`${EOL}Packages being pushed to the queue:{${pushedPackages.length}} + ${pushedPackages}`,
				),
			);
		}
		//Remove Pushed Packages from the packages array
		this.packagesToBeBuilt = this.packagesToBeBuilt.filter((el) => {
			return !pushedPackages.includes(el);
		});
		BuildStreamService.buildPackageAwaitingList(this.packagesToBeBuilt);
		this.packagesInQueue = this.packagesInQueue.filter(
			(pkg_name) => pkg_name !== sfpPackage.packageName,
		);
		BuildStreamService.buildPackageCurrentlyProcessedList(this.packagesInQueue);
	}

	private resolveDependenciesOnCompletedPackage(
		dependentPackage: string,
		completedPackage: SfpPackage,
	) {
		const pkgDescriptor = ProjectConfig.getPackageDescriptorFromConfig(
			dependentPackage,
			this.projectConfig,
		);
		const packageBranch = this.projectConfig.packageDirectories.find(
			(dir) => dir.package === completedPackage.packageName,
		).branch;
		const dependency = pkgDescriptor.dependencies.find(
			(dependency) => (dependency.package === completedPackage.packageName) || (dependency.package.includes(`${completedPackage.packageName}@`))
		);
		if (dependency.package.includes(`${completedPackage.packageName}@`)) {
			if (packageBranch) {
				const [packageName, version, branch] = this.extractPackageVersionAndBranch(dependency.package);
				SFPLogger.log(`New branched package is created for dependency: ${packageName}, update the package version id`, LoggerLevel.INFO);
				dependency.package = `${packageName}@${completedPackage.package_version_number}-${branch}`;
				this.projectConfig.packageAliases[dependency.package] = completedPackage.package_version_id;
			}
		} else {
			dependency.versionNumber = completedPackage.versionNumber;
		}

	}

	private getPriorityandTypeOfAPackage(projectConfig: any, pkg: string) {
		let priority = 0;
		let childs = DependencyHelper.getChildsOfAllPackages(
			this.props.projectDirectory,
			this.packagesToBeBuilt,
		);
		let type = ProjectConfig.getPackageType(projectConfig, pkg);
		if (type === PackageType.Unlocked) {
			if (childs[pkg].length > 0)
				priority = PRIORITY_UNLOCKED_PKG_WITH_DEPENDENCY;
			else priority = PRIORITY_UNLOCKED_PKG_WITHOUT_DEPENDENCY;
		} else if (type === PackageType.Source) {
			priority = PRIORITY_SOURCE_PKG;
		} else if (type === PackageType.Data) {
			priority = PRIORITY_DATA_PKG;
		} else if (type === PackageType.Diff) {
			priority = PRIORITY_SOURCE_PKG;
		} else {
			throw new Error(`Unknown package type ${type}`);
		}

		return { priority, type };
	}

	private printPackageDetails(sfpPackage: SfpPackage) {
		SFPLogger.log(
			COLOR_HEADER(
				`${EOL}${sfpPackage.packageName} package created in ${getFormattedTime(
					sfpPackage.creation_details.creation_time,
				)}`,
			),
		);

		SFPLogger.log(COLOR_HEADER(`-- Package Details:--`));
		const table = new Table({
			chars: COLON_MIDDLE_BORDER_TABLE,
			style: { "padding-left": 2 },
		});
		table.push([
			COLOR_HEADER(`Package Type`),
			COLOR_KEY_MESSAGE(sfpPackage.package_type),
		]);
		table.push([
			COLOR_HEADER(`Package Version Number`),
			COLOR_KEY_MESSAGE(sfpPackage.package_version_number),
		]);

		if (sfpPackage.package_type !== PackageType.Data) {
			if (sfpPackage.package_type == PackageType.Unlocked) {
				if (sfpPackage.package_version_id)
					table.push([
						COLOR_HEADER(`Package Version Id`),
						COLOR_KEY_MESSAGE(sfpPackage.package_version_id),
					]);
				if (sfpPackage.test_coverage)
					table.push([
						COLOR_HEADER(`Package Test Coverage`),
						COLOR_KEY_MESSAGE(sfpPackage.test_coverage),
					]);
				if (sfpPackage.has_passed_coverage_check)
					table.push([
						COLOR_HEADER(`Package Coverage Check Passed`),
						COLOR_KEY_MESSAGE(sfpPackage.has_passed_coverage_check),
					]);
			}

			table.push([
				COLOR_HEADER(`Metadata Count`),
				COLOR_KEY_MESSAGE(sfpPackage.metadataCount),
			]);
			table.push([
				COLOR_HEADER(`Apex In Package`),
				COLOR_KEY_MESSAGE(sfpPackage.isApexFound ? "Yes" : "No"),
			]);
			table.push([
				COLOR_HEADER(`Profiles In Package`),
				COLOR_KEY_MESSAGE(sfpPackage.isProfilesFound ? "Yes" : "No"),
			]);

			if (sfpPackage.packageType == PackageType.Diff) {
				table.push([
					COLOR_HEADER(`Source Version From`),
					COLOR_KEY_MESSAGE(sfpPackage.commitSHAFrom),
				]);
				table.push([
					COLOR_HEADER(`Source Version To`),
					COLOR_KEY_MESSAGE(sfpPackage.commitSHATo),
				]);

				table.push([
					COLOR_HEADER(`Invalidated Test Classes`),
					COLOR_KEY_MESSAGE(
						sfpPackage.apexTestClassses?.length,
					),
				]);
			}
			table.push([
				COLOR_HEADER(`Source Version`),
				COLOR_KEY_MESSAGE(sfpPackage.sourceVersion),
			]);

			SFPLogger.log(table.toString());

			const packageDependencies = this.projectConfig.packageDirectories.find(
				(dir) => dir.package === sfpPackage.package_name,
			).dependencies;
			if (
				packageDependencies &&
				Array.isArray(packageDependencies) &&
				packageDependencies.length > 0
			) {
				SFPLogger.log(COLOR_HEADER(`  Resolved package dependencies:`));
				PackageDependencyDisplayer.printPackageDependencies(
					packageDependencies,
					this.projectConfig,
					new ConsoleLogger(),
				);
			}
		}
	}

	private async createPackage(
		packageType: string,
		sfdx_package: string,
		isValidateMode: boolean,
	): Promise<SfpPackage> {
		SFPLogger.log(
			COLOR_KEY_MESSAGE(`Package creation initiated for ${sfdx_package}`),
		);
		let configFilePath = this.props.configFilePath;
		if (this.isMultiConfigFilesEnabled) {
			if (this.scratchOrgDefinitions[sfdx_package]) {
				configFilePath = this.scratchOrgDefinitions[sfdx_package];
				SFPLogger.log(
					COLOR_KEY_MESSAGE(
						`Matched scratch org definition file found for ${sfdx_package}: ${configFilePath}`,
					),
				);
			}
		}

		//Compute revision from and revision to
		let revisionFrom: string;
		let revisionTo: string;

		//let package itself create revisions 
		if (packageType == PackageType.Diff) {
			revisionFrom = undefined;
			revisionTo = undefined;
		} else {
			revisionFrom = this.props.diffOptions
				?.packagesMappedToLastKnownCommitId?.[sfdx_package]
				? this.props.diffOptions?.packagesMappedToLastKnownCommitId[
				sfdx_package
				]
				: undefined;
			revisionTo = this.props.diffOptions?.packagesMappedToLastKnownCommitId?.[
				sfdx_package
			]
				? "HEAD"
				: undefined;
		}




		return SfpPackageBuilder.buildPackageFromProjectDirectory(
			new FileLogger(`.sfpowerscripts/logs/${sfdx_package}`),
			this.props.projectDirectory,
			sfdx_package,
			{
				overridePackageTypeWith: this.props.overridePackageTypes ? this.props.overridePackageTypes[sfdx_package] : undefined,
				branch: this.props.branch,
				sourceVersion: this.commit_id,
				repositoryUrl: this.repository_url,
				configFilePath: configFilePath,
				pathToReplacementForceIgnore: this.getPathToForceIgnoreForCurrentStage(
					this.projectConfig,
					this.props.currentStage,
				),
				revisionFrom: revisionFrom,
				revisionTo: revisionTo
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
				buildNumber: this.props.buildNumber.toString(),
			},
			this.projectConfig,
		);
	}

	/**
	 * Get the file path of the forceignore for current stage, from project config.
	 * Returns null if a forceignore path is not defined in the project config for the current stage.
	 *
	 * @param projectConfig
	 * @param currentStage
	 */
	private getPathToForceIgnoreForCurrentStage(
		projectConfig: any,
		currentStage: Stage,
	): string {
		let stageForceIgnorePath: string;

		let ignoreFiles: { [key in Stage]: string } =
			projectConfig.plugins?.sfpowerscripts?.ignoreFiles;
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
			} else
				throw new Error(
					`${stageForceIgnorePath} forceignore file does not exist`,
				);
		} else return null;
	}

	private getMultiScratchOrgDefinitionFileMap(
		projectConfig: any,
	): { [key: string]: any }[] {
		this.isMultiConfigFilesEnabled =
			this.projectConfig?.plugins?.sfpowerscripts?.scratchOrgDefFilePaths?.enableMultiDefinitionFiles;
		let configFiles: { [key: string]: any }[];
		if (this.isMultiConfigFilesEnabled) {
			configFiles =
				this.projectConfig?.plugins?.sfpowerscripts?.scratchOrgDefFilePaths
					?.packages;
		}
		return configFiles;
	}

	private async resolvePackageDependencies(projectConfig: any) {
		let isDependencyResolverEnabled =
			!projectConfig?.plugins?.sfpowerscripts
				?.disableTransitiveDependencyResolver;

		if (isDependencyResolverEnabled) {
			const transitiveDependencyResolver = new TransitiveDependencyResolver(
				projectConfig,
				this.logger,
			);
			let resolvedDependencyMap =
				await transitiveDependencyResolver.resolveTransitiveDependencies();
			projectConfig = await ProjectConfig.updateProjectConfigWithDependencies(
				projectConfig,
				resolvedDependencyMap,
			);
			projectConfig = await new UserDefinedExternalDependency().cleanupEntries(
				projectConfig,
			);
			return projectConfig;
		} else {
			return projectConfig;
		}
	}

	private extractPackageVersionAndBranch(packageAlias: string): [string, string, string] {
		const parts = packageAlias.split('@');

		if (parts.length === 2) {
			const packageName = parts[0];
			const versionAndFeature = parts[1].split('-');

			if (versionAndFeature.length === 2) {
				const version = versionAndFeature[0];
				const branch = versionAndFeature[1];

				return [packageName, version, branch];
			}
		}

		return ['', '', ''];
	}

}
