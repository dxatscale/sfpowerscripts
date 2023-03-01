import  ExecuteCommand  from "@dxatscale/sfdx-process-wrapper/lib/commandExecutor/ExecuteCommand"
import SFPLogger, { COLOR_KEY_MESSAGE, COLOR_KEY_VALUE } from '@dxatscale/sfp-logger/lib/SFPLogger';
import { WorkItem } from '../../types/WorkItem';
import { RepoProvider } from './RepoProvider';
import child_process = require('child_process');

export default class AzureDevOps implements RepoProvider {
    _isCLIInstalled: boolean;

    name(): string {
        return 'azure repo';
    }

    public async isCLIInstalled(): Promise<boolean> {
        try {
            let executor: ExecuteCommand = new ExecuteCommand();
            let result = (await executor.execCommand('az version', process.cwd())) as string;
            if (result.includes('azure-devops')) {
                this._isCLIInstalled = true;
                return true;
            } else return false;
        } catch (error) {
            return false;
        }
    }
    getInstallationMessage(platform: string): string {
        if (platform === 'darwin')
            return COLOR_KEY_MESSAGE(
                ` Please install using ${COLOR_KEY_VALUE(
                    `brew install az  and then az extension add --name azure-devops`
                )} `
            );
        else if (platform === 'win32')
            return COLOR_KEY_MESSAGE(
                `  Please install using ${COLOR_KEY_VALUE(
                    `https://aka.ms/installazurecliwindows and  then  az extension add --name azure-devops`
                )} `
            );
        else
            return COLOR_KEY_MESSAGE(
                ` Please follow instruction at  https://docs.microsoft.com/en-us/cli/azure/install-azure-cli`
            );
    }
    public async raiseAPullRequest(workItem: WorkItem) {
        let pullRequestCommand = ` az repos pr create --target-branch ${workItem.trackingBranch} --open --draft`;
        let executor: ExecuteCommand = new ExecuteCommand();
        let result = (await executor.execCommand(pullRequestCommand, process.cwd())) as string;
        SFPLogger.log(result);
    }

    authenticate() {
        let pullRequestCommand = ` az devops login`;
        child_process.execSync(pullRequestCommand, {
            encoding: 'utf8',
            stdio: 'inherit',
        });
    }
}
