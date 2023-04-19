import { SfpProjectConfig } from '../../types/SfpProjectConfig';
import simpleGit, { SimpleGit } from 'simple-git';
import SFPLogger, {
    COLOR_KEY_MESSAGE,
    COLOR_WARNING,
    LoggerLevel,
} from '@dxatscale/sfp-logger/lib/SFPLogger';
import CommitWorkflow from '../git/CommitWorkflow';
import SyncGit from '../sync/SyncGit';
import inquirer = require('inquirer');
import SyncOrg from '../sync/SyncOrg';
import PushSourceToOrg from '../../impl/sfpcommands/PushSourceToOrg';
import PickAnOrgWorkflow from '../org/PickAnOrgWorkflow';
import RepoProviderSelector from '../../impl/repoprovider/RepoProviderSelector';
import AnalyzeWithPMD from '../../impl/sfpcommands/AnalyzeWithPMD';
import ProjectConfig from '@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig';
import TriggerApexTest from '../../impl/sfpcommands/TriggerApexTest';
import SelectPackageWorkflow from '../package/SelectPackageWorkflow';
import cli from 'cli-ux';

export default class SubmitWorkItemWorkflow {
    private devOrg: string;

    constructor(private sfpProjectConfig: SfpProjectConfig) {}

    async execute() {
        const git = simpleGit();
        const currentBranch = (await git.branch()).current;

        if (!this.sfpProjectConfig.getWorkItemGivenBranch(currentBranch)) {
            SFPLogger.log(`No work item found for current branch '${currentBranch}'`, LoggerLevel.ERROR);
            throw new Error("Please use 'sfp work' to create a work item");
        }

        if (await this.isSyncGit()) {
            await new SyncGit(git, this.sfpProjectConfig).execute();
        }

        if (await this.isSyncOrg()) {
            const devOrg = await this.getDevOrg(git);
            await new SyncOrg(git, this.sfpProjectConfig, devOrg).execute();
        }

        if (await this.isPushSourceToOrg()) {
            const devOrg = await this.getDevOrg(git);
            await new PushSourceToOrg(devOrg).exec();
        }

        if (await this.isPmdAnalysis()) {
            const selectPackageWorkflow = new SelectPackageWorkflow(ProjectConfig.getSFDXProjectConfig(null));
            const descriptorofChosenPackages = await selectPackageWorkflow.choosePackages(true);
            const pathOfPackages = descriptorofChosenPackages.map((descriptor) => descriptor.path);

            await new AnalyzeWithPMD(pathOfPackages, 'sfpowerkit', null, 1, '6.39.0').exec();
        }

        if (await this.isRunApexTests()) {
            const devOrg = await this.getDevOrg(git);

            const selectPackageWorkflow = new SelectPackageWorkflow(ProjectConfig.getSFDXProjectConfig(null));
            const descriptorofChosenPackages = await selectPackageWorkflow.choosePackages(true);
            const packages = descriptorofChosenPackages.map((descriptor) => descriptor.package);

            const triggerApexTest = new TriggerApexTest(
                devOrg,
                'RunAggregatedTests',
                null,
                null,
                true,
                60,
                packages,
                false,
                false,
                75
            );

            cli.action.start('Running Apex tests...');
            await triggerApexTest.exec();
            cli.action.stop();
        }

        await new CommitWorkflow(git, this.sfpProjectConfig).execute();

        SFPLogger.log(`Pushing to origin/${currentBranch}`);
        await git.push('origin', currentBranch);

        if (await this.isCreatePullRequest()) {
            const repoProvider = RepoProviderSelector.getRepoProvider(this.sfpProjectConfig.repoProvider);
            if (repoProvider.isCLIInstalled()) {
                repoProvider.raiseAPullRequest(this.sfpProjectConfig.getWorkItemGivenBranch(currentBranch));
            } else {
                SFPLogger.log(
                    `Install the ${this.sfpProjectConfig.repoProvider} CLI to enable creation of pull requests`,
                    LoggerLevel.ERROR
                );
            }
        }
    }

    private async getDevOrg(git: SimpleGit): Promise<string> {
        // Return devOrg if already set
        if (this.devOrg) return this.devOrg;

        const branches = await git.branch();
        const workItem = this.sfpProjectConfig.getWorkItemGivenBranch(branches.current);

        if (workItem?.defaultDevOrg == null) {
            SFPLogger.log(
                `  ${COLOR_WARNING(
                    `Work Item not intialized, always utilize ${COLOR_KEY_MESSAGE(`sfp work`)} to intialize work`
                )}`
            );
            this.devOrg = await new PickAnOrgWorkflow().getADevOrg();
        } else {
            this.devOrg = workItem.defaultDevOrg;
        }

        return this.devOrg;
    }

    private async isSyncGit(): Promise<boolean> {
        const answers = await inquirer.prompt({
            type: 'confirm',
            name: 'isSyncGit',
            message: 'Sync local with remote repository?',
        });

        return answers.isSyncGit;
    }

    private async isSyncOrg(): Promise<boolean> {
        const answers = await inquirer.prompt({
            type: 'confirm',
            name: 'isSyncOrg',
            message: 'Sync local with Dev org?',
        });

        return answers.isSyncOrg;
    }

    private async isPushSourceToOrg(): Promise<boolean> {
        const answers = await inquirer.prompt({
            type: 'confirm',
            name: 'isPushSourceToOrg',
            message: 'Push ALL source to Dev org?',
        });

        return answers.isPushSourceToOrg;
    }

    private async isCreatePullRequest(): Promise<boolean> {
        const answers = await inquirer.prompt({
            type: 'confirm',
            name: 'isCreatePullRequest',
            message: 'Create pull request?',
        });

        return answers.isCreatePullRequest;
    }

    private async isPmdAnalysis(): Promise<boolean> {
        const answers = await inquirer.prompt({
            type: 'confirm',
            name: 'isPmdAnalysis',
            message: 'Run PMD static code analysis?',
        });

        return answers.isPmdAnalysis;
    }
    private async isRunApexTests(): Promise<boolean> {
        const answers = await inquirer.prompt({
            type: 'confirm',
            name: 'isRunApexTests',
            message: 'Run Apex tests?',
        });

        return answers.isRunApexTests;
    }
}
