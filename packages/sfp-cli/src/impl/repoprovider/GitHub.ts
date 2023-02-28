import  ExecuteCommand  from "@dxatscale/sfdx-process-wrapper/lib/commandExecutor/ExecuteCommand"
import SFPLogger, { COLOR_KEY_MESSAGE, COLOR_KEY_VALUE } from '@dxatscale/sfp-logger/lib/SFPLogger';
import { WorkItem } from '../../types/WorkItem';
import child_process = require('child_process');
import { RepoProvider } from './RepoProvider';

export default class GitHub implements RepoProvider {
    private _isCLIInstalled: boolean = false;

    name(): string {
        return 'github';
    }

    public async isCLIInstalled(): Promise<boolean> {
        try {
            let executor: ExecuteCommand = new ExecuteCommand();
            let result = (await executor.execCommand('gh --version', process.cwd())) as string;
            if (result.includes('https://github.com/cli')) {
                this._isCLIInstalled = true;
                return true;
            } else return false;
        } catch (error) {
            return false;
        }
    }

    public getInstallationMessage(platform: string): string {
        if (platform === 'darwin')
            return COLOR_KEY_MESSAGE(` Please install using ${COLOR_KEY_VALUE(`brew install gh`)} `);
        else if (platform === 'win32')
            return COLOR_KEY_MESSAGE(`  Please install using ${COLOR_KEY_VALUE(`winget install gh`)} `);
        else return COLOR_KEY_MESSAGE(` Please follow instruction at  https://github.com/cli/cli#installation`);
    }

    public async raiseAPullRequest(workItem: WorkItem) {
        let pullRequestCommand = ` gh pr create --base ${workItem.trackingBranch} --fill --draft`;
        let executor: ExecuteCommand = new ExecuteCommand();
        let result = (await executor.execCommand(pullRequestCommand, process.cwd())) as string;
        SFPLogger.log(result);
    }

    public async authenticate() {
        let pullRequestCommand = ` gh auth login`;
        child_process.execSync(pullRequestCommand, {
            encoding: 'utf8',
            stdio: 'inherit',
        });
    }
}
