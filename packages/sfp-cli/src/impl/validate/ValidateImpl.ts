import BuildImpl, { BuildProps } from "../parallelBuilder/BuildImpl";
import DeployImpl, {
	DeploymentMode,
	DeployProps,
	DeploymentResult,
} from "../deploy/DeployImpl";
import ArtifactGenerator from "../../core/artifacts/generators/ArtifactGenerator";
import { Stage } from "../Stage";
import SFPLogger, {
	COLOR_KEY_VALUE,
	COLOR_TRACE,
	ConsoleLogger,
	Logger,
	LoggerLevel,
} from "@flxblio/sfp-logger";
import {
	PackageInstallationResult,
	PackageInstallationStatus,
} from "../../core/package/packageInstallers/PackageInstallationResult";
import { PackageDiffOptions } from "../../core/package/diff/PackageDiffImpl";
import PoolFetchImpl from "../../core/scratchorg/pool/PoolFetchImpl";
import { Org } from "@salesforce/core";
import InstalledArtifactsDisplayer from "../../core/display/InstalledArtifactsDisplayer";
import ValidateError from "../../errors/ValidateError";
import ScratchOrg from "../../core/scratchorg/ScratchOrg";
import { COLOR_KEY_MESSAGE } from "@flxblio/sfp-logger";
import { COLOR_WARNING } from "@flxblio/sfp-logger";
import { COLOR_ERROR } from "@flxblio/sfp-logger";
import { COLOR_HEADER } from "@flxblio/sfp-logger";
import { COLOR_SUCCESS } from "@flxblio/sfp-logger";
import { COLOR_TIME } from "@flxblio/sfp-logger";
import SFPStatsSender from "../../core/stats/SFPStatsSender";
import ScratchOrgInfoFetcher from "../../core/scratchorg/pool/services/fetchers/ScratchOrgInfoFetcher";
import ScratchOrgInfoAssigner from "../../core/scratchorg/pool/services/updaters/ScratchOrgInfoAssigner";
import ValidateResult from "./ValidateResult";
import PoolOrgDeleteImpl from "../../core/scratchorg/pool/PoolOrgDeleteImpl";
import SFPOrg from "../../core/org/SFPOrg";
import SfpPackage, {
	PackageType,
} from "../../core/package/SfpPackage";

import getFormattedTime from "../../core/utils/GetFormattedTime";
import { PostDeployHook } from "../deploy/PostDeployHook";
import * as rimraf from "rimraf";
import ProjectConfig from "../../core/project/ProjectConfig";
import InstallUnlockedPackageCollection from "../../core/package/packageInstallers/InstallUnlockedPackageCollection";
import ExternalPackage2DependencyResolver from "../../core/package/dependencies/ExternalPackage2DependencyResolver";
import ExternalDependencyDisplayer from "../../core/display/ExternalDependencyDisplayer";
import { PreDeployHook } from "../deploy/PreDeployHook";
import GroupConsoleLogs from "../../ui/GroupConsoleLogs";
import ReleaseConfigLoader from "../release/ReleaseConfigLoader";
import { mapInstalledArtifactstoPkgAndCommits } from "../../utils/FetchArtifactsFromOrg";
import { ApexTestValidator } from "./ApexTestValidator";
import OrgInfoDisplayer from "../../ui/OrgInfoDisplayer";
import FileOutputHandler from "../../outputs/FileOutputHandler";


export enum ValidateAgainst {
	PROVIDED_ORG = "PROVIDED_ORG",
	PRECREATED_POOL = "PRECREATED_POOL",
}
export enum ValidationMode {
	INDIVIDUAL = "individual",
	FAST_FEEDBACK = "fastfeedback",
	THOROUGH = "thorough",
	FASTFEEDBACK_LIMITED_BY_RELEASE_CONFIG = "ff-release-config",
	THOROUGH_LIMITED_BY_RELEASE_CONFIG = "thorough-release-config",
}

export interface ValidateProps {
	installExternalDependencies?: boolean;
	validateAgainst: ValidateAgainst;
	validationMode: ValidationMode;
	releaseConfigPath?: string;
	coverageThreshold: number;
	logsGroupSymbol: string[];
	targetOrg?: string;
	hubOrg?: Org;
	pools?: string[];
	shapeFile?: string;
	isDeleteScratchOrg?: boolean;
	keys?: string;
	baseBranch?: string;
	diffcheck?: boolean;
	disableArtifactCommit?: boolean;
	orgInfo?: boolean;
	disableSourcePackageOverride?: boolean;
	disableParallelTestExecution?: boolean;
}

export default class ValidateImpl implements PostDeployHook, PreDeployHook {

	private logger = new ConsoleLogger();
	private orgAsSFPOrg: SFPOrg;

	constructor(private props: ValidateProps) { }

	public async exec(): Promise<ValidateResult> {
		rimraf.sync("artifacts");

		let deploymentResult: DeploymentResult;
		let scratchOrgUsername: string;
		try {

			if (this.props.validateAgainst === ValidateAgainst.PROVIDED_ORG) {
				scratchOrgUsername = this.props.targetOrg;
			} else if (
				this.props.validateAgainst === ValidateAgainst.PRECREATED_POOL
			) {
				if (process.env.SFPOWERSCRIPTS_DEBUG_PREFETCHED_SCRATCHORG)
					scratchOrgUsername =
						process.env.SFPOWERSCRIPTS_DEBUG_PREFETCHED_SCRATCHORG;
				else
					scratchOrgUsername = await this.fetchScratchOrgFromPool(
						this.props.pools,
						this.props.orgInfo,
					);
			} else throw new Error(`Unknown mode ${this.props.validateAgainst}`);

			//Create Org
			this.orgAsSFPOrg = await SFPOrg.create({
				aliasOrUsername: scratchOrgUsername,
			});


			//Print Org Info for validateAgainstOrg modes
			//TODO: Not ideal need to unify sfpOrg and scratchOrg and then make this a global method
			if (this.props.orgInfo && this.props.validateAgainst === ValidateAgainst.PROVIDED_ORG){
				OrgInfoDisplayer.printOrgInfo(this.orgAsSFPOrg);
				OrgInfoDisplayer.writeOrgInfoToMarkDown(this.orgAsSFPOrg);
			}


			//Fetch Artifacts in the org
			let packagesInstalledInOrgMappedToCommits: { [p: string]: string };

			if (this.props.validationMode !== ValidationMode.INDIVIDUAL) {
				let installedArtifacts = await this.orgAsSFPOrg.getInstalledArtifacts();
				if (installedArtifacts.length == 0) {
					SFPLogger.log(
						COLOR_ERROR("Failed to query org for sfp Artifacts"),
					);
				}
				packagesInstalledInOrgMappedToCommits =
					await mapInstalledArtifactstoPkgAndCommits(installedArtifacts);
				this.printArtifactVersions(this.orgAsSFPOrg, installedArtifacts);
			}
			//In individual mode, always build changed packages only especially for validateAgainstOrg
			if (this.props.validationMode == ValidationMode.INDIVIDUAL)
				this.props.diffcheck = true;

			let builtSfpPackages = await this.buildChangedSourcePackages(
				packagesInstalledInOrgMappedToCommits,
			);
			deploymentResult = await this.deploySourcePackages(scratchOrgUsername);

			if (deploymentResult.failed.length > 0 || deploymentResult.error)
				throw new ValidateError("Validation failed", { deploymentResult });

			return {
				deploymentResult
			}
		} catch (error) {
			if (
				error.message?.includes(
					`No changes detected in the packages to be built`,
				)
			) {
				SFPLogger.log(
					`WARNING: No changes detected in any of the packages, Validation is treated as a success`,
					LoggerLevel.WARN,
				);
				return;
			} else if (error instanceof ValidateError)
				SFPLogger.log(`Validation failed due to : ${error}`, LoggerLevel.DEBUG);
			else SFPLogger.log(`Failure Reason: ${error}`, LoggerLevel.ERROR);
			throw error;
		} finally {
			await this.handleScratchOrgStatus(
				scratchOrgUsername,
				deploymentResult,
				this.props.isDeleteScratchOrg,
			);
		}
	}

	private async printArtifactVersions(
		orgAsSFPOrg: SFPOrg,
		installedArtifacts: any,
	) {
		let groupSection = new GroupConsoleLogs(
			`Artifacts installed in the Org ${orgAsSFPOrg.getUsername()}`,
		).begin();

		InstalledArtifactsDisplayer.printInstalledArtifacts(
			installedArtifacts,
			null,
		);

		groupSection.end();
	}


	private async installPackageDependencies(
		sfdxProjectConfig: any,
		scratchOrgAsSFPOrg: SFPOrg,
		sfpPackage: SfpPackage,
		deployedPackages?: SfpPackage[],
	) {
		let deployedPackagesAsStringArray: Array<string> = [];
		for (const deployedPackage of deployedPackages) {
			deployedPackagesAsStringArray.push(deployedPackage.package_name);
		}

		//Resolve external package dependencies
		let externalPackageResolver = new ExternalPackage2DependencyResolver(
			this.props.hubOrg.getConnection(),
			sfdxProjectConfig,
			this.props.keys,
		);
		let externalPackage2s =
			await externalPackageResolver.resolveExternalPackage2DependenciesToVersions(
				[sfpPackage.packageName],
				deployedPackagesAsStringArray,
			);

		SFPLogger.log(
			`Installing package dependencies of this ${sfpPackage.packageName
			} in ${scratchOrgAsSFPOrg.getUsername()}`,
			LoggerLevel.INFO,
			new ConsoleLogger(),
		);
		//Display resolved dependenencies
		let externalDependencyDisplayer = new ExternalDependencyDisplayer(
			externalPackage2s,
			new ConsoleLogger(),
		);
		externalDependencyDisplayer.display();

		let packageCollectionInstaller = new InstallUnlockedPackageCollection(
			scratchOrgAsSFPOrg,
			new ConsoleLogger(),
		);
		await packageCollectionInstaller.install(externalPackage2s, true, true);

		SFPLogger.log(
			COLOR_KEY_MESSAGE(
				`Successfully completed external dependencies of this ${sfpPackage.packageName
				} in ${scratchOrgAsSFPOrg.getUsername()}`,
			),
		);
	}

	private async handleScratchOrgStatus(
		scratchOrgUsername: string,
		deploymentResult: DeploymentResult,
		isToDelete: boolean,
	) {
		//No scratch org available.. just return
		if (scratchOrgUsername == undefined) return;

		if (isToDelete) {
			//If deploymentResult is not available, or there is 0 packages deployed, we can reuse the org
			if (!deploymentResult || deploymentResult.deployed.length == 0) {
				SFPLogger.log(
					`Attempting to return scratch org ${scratchOrgUsername} back to pool`,
					LoggerLevel.INFO,
				);
				const scratchOrgInfoAssigner = new ScratchOrgInfoAssigner(
					this.props.hubOrg,
				);
				try {
					const result = await scratchOrgInfoAssigner.setScratchOrgStatus(
						scratchOrgUsername,
						"Return",
					);
					if (result)
						SFPLogger.log(
							`Succesfully returned ${scratchOrgUsername} back to pool`,
							LoggerLevel.INFO,
						);
					else
						SFPLogger.log(
							COLOR_WARNING(
								`Unable to return scratch org to pool, Please check permissions or update sfpower-pool-package to latest`,
							),
						);
				} catch (error) {
					SFPLogger.log(
						COLOR_WARNING(
							`Unable to return scratch org to pool, Please check permissions or update sfpower-pool-package to latest`,
						),
					);
				}
			} else {
				try {
					if (scratchOrgUsername && this.props.hubOrg.getUsername()) {
						await deleteScratchOrg(this.props.hubOrg, scratchOrgUsername);
					}
				} catch (error) {
					SFPLogger.log(COLOR_WARNING(error.message));
				}
			}
		}
		async function deleteScratchOrg(hubOrg: Org, scratchOrgUsername: string) {
			SFPLogger.log(
				`Deleting scratch org ${scratchOrgUsername}`,
				LoggerLevel.INFO,
			);
			const poolOrgDeleteImpl = new PoolOrgDeleteImpl(
				hubOrg,
				scratchOrgUsername,
			);
			await poolOrgDeleteImpl.execute();
		}
	}

	private async deploySourcePackages(
		scratchOrgUsername: string,
	): Promise<DeploymentResult> {
		const deployStartTime: number = Date.now();

		const deployProps: DeployProps = {
			targetUsername: scratchOrgUsername,
			artifactDir: "artifacts",
			waitTime: 120,
			deploymentMode:
				this.props.disableSourcePackageOverride == true
					? DeploymentMode.NORMAL
					: DeploymentMode.SOURCEPACKAGES,
			isTestsToBeTriggered: true,
			skipIfPackageInstalled: false,
			logsGroupSymbol: this.props.logsGroupSymbol,
			currentStage: Stage.VALIDATE,
			disableArtifactCommit: this.props.disableArtifactCommit,
			selectiveComponentDeployment:
				this.props.validationMode == ValidationMode.FAST_FEEDBACK || this.props.validationMode == ValidationMode.FASTFEEDBACK_LIMITED_BY_RELEASE_CONFIG

		};




		const deployImpl: DeployImpl = new DeployImpl(deployProps);
		deployImpl.postDeployHook = this;
		deployImpl.preDeployHook = this;

		const deploymentResult = await deployImpl.exec();

		const deploymentElapsedTime: number = Date.now() - deployStartTime;
		printDeploySummary(deploymentResult, deploymentElapsedTime);

		return deploymentResult;

		function printDeploySummary(
			deploymentResult: DeploymentResult,
			totalElapsedTime: number,
		): void {
			let groupSection = new GroupConsoleLogs(`Deployment Summary`).begin();
			SFPLogger.printHeaderLine('',COLOR_HEADER,LoggerLevel.INFO);
			SFPLogger.log(
				COLOR_SUCCESS(
					`${deploymentResult.deployed.length
					} packages deployed in ${COLOR_TIME(
						getFormattedTime(totalElapsedTime),
					)} with {${COLOR_ERROR(
						deploymentResult.failed.length,
					)}} failed deployments`,
				),
			);

			if (deploymentResult.failed.length > 0) {
				SFPLogger.log(
					COLOR_ERROR(
						`\nPackages Failed to Deploy`,
						deploymentResult.failed.map(
							(packageInfo) => packageInfo.sfpPackage.packageName,
						),
					),
				);

				FileOutputHandler.getInstance().appendOutput(`validation-error.md`,`### 💣 Deployment Failed  💣`);
				let firstPackageFailedToValdiate = deploymentResult.failed[0];
				FileOutputHandler.getInstance().appendOutput(`validation-error.md`,`Package validation failed for  **${firstPackageFailedToValdiate.sfpPackage.packageName}** due to`);  
				FileOutputHandler.getInstance().appendOutput(`validation-error.md`,"");  
				FileOutputHandler.getInstance().appendOutput(`validation-error.md`,deploymentResult.error);  

				FileOutputHandler.getInstance().appendOutput(`validation-error.md`,`Package that are not validated:`);  
				deploymentResult.failed.map(
					(packageInfo, index) => {
						if (index!=0)
						 FileOutputHandler.getInstance().appendOutput(`validation-error.md`,`**${packageInfo.sfpPackage.packageName}**`);    
					}
				);
			}

			SFPLogger.printHeaderLine('',COLOR_HEADER,LoggerLevel.INFO);
			groupSection.end();
		}
	}

	private async buildChangedSourcePackages(packagesInstalledInOrgMappedToCommits: {
		[p: string]: string;
	}): Promise<SfpPackage[]> {
		let groupSection = new GroupConsoleLogs("Building Packages").begin();

		const buildStartTime: number = Date.now();




		const buildProps: BuildProps = {
			buildNumber: 1,
			executorcount: 10,
			waitTime: 120,
			isDiffCheckEnabled: this.props.diffcheck,
			isQuickBuild: true,
			isBuildAllAsSourcePackages: !this.props.disableSourcePackageOverride,
			currentStage: Stage.VALIDATE,
			baseBranch: this.props.baseBranch,
			devhubAlias: this.props.hubOrg?.getUsername()
		};

		//Build DiffOptions
		const diffOptions: PackageDiffOptions = buildDiffOption(this.props);
		buildProps.diffOptions = diffOptions;


		//compute pkg overides
		buildProps.overridePackageTypes = computePackageOverrides(this.props)


		//Compute packages to be included
		buildProps.includeOnlyPackages = fetchPackagesAsPerReleaseConfig(
			this.logger,
			this.props,
		);
		if (buildProps.includeOnlyPackages) {
			printIncludeOnlyPackages(buildProps.includeOnlyPackages);
		}

		const buildImpl: BuildImpl = new BuildImpl(buildProps);
		const { generatedPackages, failedPackages } = await buildImpl.exec();

		if (failedPackages.length > 0)
			throw new Error(`Failed to create packages ${failedPackages}`);

		if (generatedPackages.length === 0) {
			throw new Error(
				`No changes detected in the packages to be built\nvalidate will only execute if there is a change in atleast one of the packages`,
			);
		}

		for (const generatedPackage of generatedPackages) {
			try {
				await ArtifactGenerator.generateArtifact(
					generatedPackage,
					process.cwd(),
					"artifacts",
				);
			} catch (error) {
				SFPLogger.log(
					COLOR_ERROR(
						`Unable to create artifact for ${generatedPackage.packageName}`,
					),
				);
				throw error;
			}
		}
		const buildElapsedTime: number = Date.now() - buildStartTime;

		printBuildSummary(generatedPackages, failedPackages, buildElapsedTime);

		groupSection.end();

		return generatedPackages;


		function computePackageOverrides(props: ValidateProps): { [key: string]: PackageType } {
            let overridedPackages: { [key: string]: PackageType } = {};
            const allPackages = ProjectConfig.getAllPackages(null);
            const projectConfig = ProjectConfig.getSFDXProjectConfig(null);
            for (const pkg of allPackages) {
                if (ProjectConfig.getPackageType(projectConfig, pkg) !== PackageType.Data) {
                    if (
                        props.validationMode === ValidationMode.FASTFEEDBACK_LIMITED_BY_RELEASE_CONFIG ||
                        props.validationMode === ValidationMode.FAST_FEEDBACK
                    ) {
                        overridedPackages[pkg] = PackageType.Diff;
                    } else {
                        if (!props.disableSourcePackageOverride) {
                            if (ProjectConfig.getPackageType(projectConfig, pkg) == PackageType.Unlocked) {
                                overridedPackages[pkg] = PackageType.Source;
                            }
                        }
                    }
                }
            }
            return overridedPackages;
        }

		function fetchPackagesAsPerReleaseConfig(
			logger: Logger,
			props: ValidateProps,
		) {
			if (
				props.validationMode ===
				ValidationMode.FASTFEEDBACK_LIMITED_BY_RELEASE_CONFIG ||
				props.validationMode ===
				ValidationMode.THOROUGH_LIMITED_BY_RELEASE_CONFIG
			) {
				let releaseConfigLoader: ReleaseConfigLoader = new ReleaseConfigLoader(
					logger,
					props.releaseConfigPath,
					true
				);
				return releaseConfigLoader.getPackagesAsPerReleaseConfig();
			}
		}

		//generate diff Option
		function buildDiffOption(props: ValidateProps) {
			const diffOptions: PackageDiffOptions = new PackageDiffOptions();
			//In fast feedback ignore package descriptor changes
			if (
				props.validationMode === ValidationMode.FAST_FEEDBACK
			) {
				diffOptions.skipPackageDescriptorChange = true;
				diffOptions.useLatestGitTags = false;
				diffOptions.packagesMappedToLastKnownCommitId =
					packagesInstalledInOrgMappedToCommits;
			}
			else if (props.validationMode === ValidationMode.THOROUGH) {
				diffOptions.skipPackageDescriptorChange = false;
				diffOptions.useLatestGitTags = false;
				diffOptions.packagesMappedToLastKnownCommitId =
					packagesInstalledInOrgMappedToCommits;
			} else if (props.validationMode === ValidationMode.INDIVIDUAL) {
				diffOptions.skipPackageDescriptorChange = false;
				//Dont send whats installed in orgs, use only the changed package from last know git tags
				diffOptions.useLatestGitTags = true;
				diffOptions.packagesMappedToLastKnownCommitId = null;
			} else if (
				props.validationMode ===
				ValidationMode.THOROUGH_LIMITED_BY_RELEASE_CONFIG
			) {
				diffOptions.skipPackageDescriptorChange = false;
				diffOptions.useLatestGitTags = false;
				diffOptions.packagesMappedToLastKnownCommitId =
					packagesInstalledInOrgMappedToCommits;
			} else if (
				props.validationMode ===
				ValidationMode.FASTFEEDBACK_LIMITED_BY_RELEASE_CONFIG
			) {
				diffOptions.skipPackageDescriptorChange = true;
				diffOptions.useLatestGitTags = false;
				diffOptions.packagesMappedToLastKnownCommitId =
					packagesInstalledInOrgMappedToCommits;
			}
			return diffOptions;
		}

		function printBuildSummary(
			generatedPackages: SfpPackage[],
			failedPackages: string[],
			totalElapsedTime: number,
		): void {
			SFPLogger.printHeaderLine('',COLOR_HEADER,LoggerLevel.INFO);
			SFPLogger.log(
				COLOR_SUCCESS(
					`${generatedPackages.length} packages created in ${COLOR_TIME(
						getFormattedTime(totalElapsedTime),
					)} with {${COLOR_ERROR(failedPackages.length)}} errors`,
				),
			);

			if (failedPackages.length > 0) {
				SFPLogger.log(COLOR_ERROR(`Packages Failed To Build`, failedPackages));
			}
			SFPLogger.printHeaderLine('',COLOR_HEADER,LoggerLevel.INFO);
		}

		function printIncludeOnlyPackages(includeOnlyPackages: string[]) {
			SFPLogger.log(
				COLOR_KEY_MESSAGE(
					`Build will include the below packages as per inclusive filter`,
				),
				LoggerLevel.INFO,
			);
			SFPLogger.log(
				COLOR_KEY_VALUE(`${includeOnlyPackages.toString()}`),
				LoggerLevel.INFO,
			);
		}
	}

	private async fetchScratchOrgFromPool(
		pools: string[],
		displayOrgInfo?: boolean,
	): Promise<string> {
		let scratchOrgUsername: string;

		for (const pool of pools) {
			let scratchOrg: ScratchOrg;
			try {
				const poolFetchImpl = new PoolFetchImpl(
					this.props.hubOrg,
					pool.trim(),
					false,
					true,
				);
				scratchOrg = (await poolFetchImpl.execute()) as ScratchOrg;
			} catch (error) {
				SFPLogger.log(error.message, LoggerLevel.TRACE);
			}
			if (scratchOrg && scratchOrg.status === "Assigned") {
				scratchOrgUsername = scratchOrg.username;
				SFPLogger.log(
					COLOR_KEY_MESSAGE(
						`Fetched scratch org ${scratchOrgUsername} from ${COLOR_KEY_VALUE(
							pool,
						)}`,
					),
					LoggerLevel.INFO,
					this.logger,
				);

				if (displayOrgInfo) {
					OrgInfoDisplayer.printScratchOrgInfo(scratchOrg);
					OrgInfoDisplayer.writeScratchOrgInfoToMarkDown(scratchOrg);
				}

				this.getCurrentRemainingNumberOfOrgsInPoolAndReport(scratchOrg.tag);
				break;
			}
		}

		if (scratchOrgUsername) return scratchOrgUsername;
		else
			throw new Error(
				`Failed to fetch scratch org from ${pools}, Are you sure you created this pool using a DevHub authenticated using auth:sfdxurl or auth:web or auth:accesstoken:store`,
			);


	}

	private async getCurrentRemainingNumberOfOrgsInPoolAndReport(tag: string) {
		try {
			const results = await new ScratchOrgInfoFetcher(
				this.props.hubOrg,
			).getScratchOrgsByTag(tag, false, true);

			const availableSo = results.records.filter(
				(soInfo) => soInfo.Allocation_status__c === "Available",
			);

			SFPStatsSender.logGauge("pool.available", availableSo.length, {
				poolName: tag,
			});
		} catch (error) {
			//do nothing, we are not reporting anything if anything goes wrong here
		}
	}

	async preDeployPackage(
    sfpPackage: SfpPackage,
    targetUsername: string,
    deployedPackages?: SfpPackage[],
    devhubUserName?: string,
): Promise<{ isToFailDeployment: boolean; message?: string }> {

    const shouldInstallDependencies = (mode: ValidationMode) => {
        if (this.props.validateAgainst === ValidateAgainst.PROVIDED_ORG &&
            !this.props.installExternalDependencies) {
            return false;
        }

        const isThoroughValidation = mode === ValidationMode.THOROUGH ||
            mode === ValidationMode.THOROUGH_LIMITED_BY_RELEASE_CONFIG;

        const isFastFeedbackWithExternalDependencies =
            (mode === ValidationMode.FASTFEEDBACK_LIMITED_BY_RELEASE_CONFIG ||
                mode === ValidationMode.FAST_FEEDBACK) &&
            this.props.installExternalDependencies;

        return isThoroughValidation ||
            mode === ValidationMode.INDIVIDUAL ||
            isFastFeedbackWithExternalDependencies;
    };

    if (shouldInstallDependencies(this.props.validationMode)) {
        const projectConfig = this.props.validationMode === ValidationMode.INDIVIDUAL ?
            ProjectConfig.cleanupMPDFromProjectDirectory(null, sfpPackage.package_name) :
            ProjectConfig.getSFDXProjectConfig(null);

        await this.installPackageDependencies(
            projectConfig,
            this.orgAsSFPOrg,
            sfpPackage,
            deployedPackages,
        );
    }

    return { isToFailDeployment: false };
}


	async postDeployPackage(
		sfpPackage: SfpPackage,
		packageInstallationResult: PackageInstallationResult,
		targetUsername: string,
		deployedPackages?: SfpPackage[],
		devhubUserName?: string,
	): Promise<{ isToFailDeployment: boolean; message?: string }> {
		//Trigger Tests after installation of each package
		if (sfpPackage.packageType && sfpPackage.packageType != PackageType.Data) {
			if (
				packageInstallationResult.result === PackageInstallationStatus.Succeeded
			) {
				//Get Changed Components
				const apextestValidator = new ApexTestValidator(targetUsername, sfpPackage, this.props, this.logger);
				const testResult = await apextestValidator.validateApexTests();

				if (!testResult.result) {
					FileOutputHandler.getInstance().appendOutput(`validation-error.md`,`### 💣 Validation Failed  💣`);
					FileOutputHandler.getInstance().appendOutput(`validation-error.md`,`Package validation failed for  **${sfpPackage.packageName}**`);
					FileOutputHandler.getInstance().appendOutput(`validation-error.md`,`Reasons:`);
					FileOutputHandler.getInstance().appendOutput(`validation-error.md`,`${testResult.message}`);
				}

				return {
					isToFailDeployment: !testResult.result,
					message: testResult.message,
				};
			}
		}
		return { isToFailDeployment: false };
	}


}
