const fs = require('fs');
const path = require('path');
import Git from '../../git/Git';
import IgnoreFiles from '../../ignore/IgnoreFiles';
import SFPLogger, { COLOR_ERROR, COLOR_KEY_MESSAGE, Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import ProjectConfig from '../../project/ProjectConfig';
import GitTags from '../../git/GitTags';
import lodash = require('lodash');
import { EOL } from 'os';
import { PackageType } from '../SfpPackage';

export class PackageDiffOptions {
    skipPackageDescriptorChange?: boolean = false;
    //If not set, utlize latest git tags
    useLatestGitTags?:boolean=true;
    packagesMappedToLastKnownCommitId?: { [p: string]: string };
    pathToReplacementForceIgnore?: string;
}

export default class PackageDiffImpl {
    public constructor(
        private logger: Logger,
        private sfdx_package: string,
        private project_directory: string|null,
        private diffOptions?: PackageDiffOptions
    ) {}

    public async exec(): Promise<{ isToBeBuilt: boolean; reason: string; tag?: string }> {
        let git: Git = await Git.initiateRepo(this.logger,this.project_directory);

        let projectConfig = ProjectConfig.getSFDXProjectConfig(this.project_directory);
        let pkgDescriptor = ProjectConfig.getPackageDescriptorFromConfig(this.sfdx_package, projectConfig);

        SFPLogger.log(
            COLOR_KEY_MESSAGE(
                `${EOL}Checking last known tags for ${this.sfdx_package} to determine whether package is to be built...`,
            ),
            LoggerLevel.TRACE,
            this.logger
        );

        let tag: string;
        if (!this.diffOptions?.useLatestGitTags && this.diffOptions?.packagesMappedToLastKnownCommitId != null) {
            tag = this.getLatestCommitFromMap(this.sfdx_package, this.diffOptions?.packagesMappedToLastKnownCommitId);
        } else {
            tag = await this.getLatestTagFromGit(git, this.sfdx_package);
        }

        if (tag) {
            SFPLogger.log(COLOR_KEY_MESSAGE(`\nUtilizing tag ${tag} for ${this.sfdx_package}`),LoggerLevel.TRACE,this.logger);

            // Get the list of modified files between the tag and HEAD refs
            let modified_files: string[];
            try {
                modified_files = await git.diff([`${tag}`, `HEAD`, `--no-renames`, `--name-only`]);
            } catch (error) {
                SFPLogger.log(COLOR_ERROR(`Unable to compute diff, The head of the branch is not reachable from the commit id ${tag}`));
                SFPLogger.log(COLOR_ERROR(`Check your current branch (in case of build) or the scratch org in case of validate command`));
                SFPLogger.log(COLOR_ERROR(`Actual error received:`));
                SFPLogger.log(COLOR_ERROR(error));
                throw new Error(`Failed to compute git diff for package ${this.sfdx_package} against commit id ${tag}`)
            }

            let packageType: string = ProjectConfig.getPackageType(projectConfig, this.sfdx_package);

            if (packageType !== PackageType.Data) modified_files = this.applyForceIgnoreToModifiedFiles(modified_files);

            SFPLogger.log(
                `Checking for changes in source directory ${path.normalize(pkgDescriptor.path)}`,
                LoggerLevel.TRACE,
                this.logger
            );

            // Check whether the package has been modified
            for (let filename of modified_files) {
                if (filename.includes(path.normalize(pkgDescriptor.path))) {
                    SFPLogger.log(`Found change(s) in ${filename}`, LoggerLevel.TRACE, this.logger);
                    return { isToBeBuilt: true, reason: `Found change(s) in package`, tag: tag };
                }
            }

            SFPLogger.log(
                `Checking for changes to package descriptor in sfdx-project.json`,
                LoggerLevel.TRACE,
                this.logger
            );
            let isPackageDescriptorChanged = await this.isPackageDescriptorChanged(git, tag, pkgDescriptor);
            if (isPackageDescriptorChanged) {
                return { isToBeBuilt: true, reason: `Package Descriptor Changed`, tag: tag };
            }

            return { isToBeBuilt: false, reason: `No changes found`, tag: tag };
        } else {
            SFPLogger.log(
                `Tag missing for ${this.sfdx_package}...marking package for build anyways`,
                LoggerLevel.TRACE,
                this.logger
            );
            return { isToBeBuilt: true, reason: `Previous version not found` };
        }
    }

    private applyForceIgnoreToModifiedFiles(modified_files: string[]) {
        let forceignorePath: string;
        if (this.diffOptions?.pathToReplacementForceIgnore) forceignorePath = this.diffOptions?.pathToReplacementForceIgnore;
        else if (this.project_directory != null) forceignorePath = path.join(this.project_directory, '.forceignore');
        else forceignorePath = '.forceignore';

        let ignoreFiles: IgnoreFiles = new IgnoreFiles(fs.readFileSync(forceignorePath).toString());

        // Filter the list of modified files with .forceignore
        modified_files = ignoreFiles.filter(modified_files);

        return modified_files;
    }

    private async getLatestTagFromGit(git: Git, sfdx_package: string): Promise<string> {
        const gitTags: GitTags = new GitTags(git, sfdx_package);
        let tags: string[] = await gitTags.listTagsOnBranch();

        SFPLogger.log('Analysing tags:', LoggerLevel.DEBUG);
        if (tags.length > 10) {
            SFPLogger.log(tags.slice(-10).toString().replace(/,/g, '\n'), LoggerLevel.TRACE,this.logger);
        } else {
            SFPLogger.log(tags.toString().replace(/,/g, '\n'), LoggerLevel.TRACE,this.logger);
        }

        return tags.pop();
    }

    private async isPackageDescriptorChanged(git: Git, latestTag: string, packageDescriptor: any): Promise<boolean> {
        let projectConfigJson: string = await git.show([`${latestTag}:sfdx-project.json`]);
        let projectConfig = JSON.parse(projectConfigJson);

        let packageDescriptorFromLatestTag: string;
        for (let dir of projectConfig['packageDirectories']) {
            if (this.sfdx_package === dir.package) {
                packageDescriptorFromLatestTag = dir;
            }
        }

        if (!lodash.isEqual(packageDescriptor, packageDescriptorFromLatestTag)) {
            SFPLogger.log(`Found change in ${this.sfdx_package} package descriptor`, LoggerLevel.TRACE, this.logger);

            //skip check and ignore
            if (this.diffOptions?.skipPackageDescriptorChange) {
                SFPLogger.log(`Ignoring changes in package desriptor as asked to..`, LoggerLevel.TRACE, this.logger);
                return false;
            } else return true;
        } else return false;
    }

    private getLatestCommitFromMap(sfdx_package: string, packagesToCommits: { [p: string]: string }): string {
        if (packagesToCommits[sfdx_package] != null) {
            return packagesToCommits[sfdx_package];
        } else {
            return null;
        }
    }
}
