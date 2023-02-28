import  ExecuteCommand  from "@dxatscale/sfdx-process-wrapper/lib/commandExecutor/ExecuteCommand"
import SFPLogger, { COLOR_KEY_MESSAGE, COLOR_KEY_VALUE } from '@dxatscale/sfp-logger/lib/SFPLogger';
import { WorkItem } from '../../types/WorkItem';
import { RepoProvider } from './RepoProvider';
import child_process = require('child_process');

export default class Gitlab implements RepoProvider {
    _isCLIInstalled: boolean;

    name(): string {
        return 'gitlab';
    }

    public async isCLIInstalled(): Promise<boolean> {
        try {
            let executor: ExecuteCommand = new ExecuteCommand();
            let result = (await executor.execCommand('glab --version', process.cwd())) as string;
            if (result.includes('glab version')) {
                this._isCLIInstalled = true;
                return true;
            } else return false;
        } catch (error) {
            return false;
        }
    }

    public getInstallationMessage(platform: string): string {
        if (platform === 'darwin')
            return COLOR_KEY_MESSAGE(` Please install using ${COLOR_KEY_VALUE(`brew install glab`)} `);
        else if (platform === 'win32')
            return COLOR_KEY_MESSAGE(`  Please install using ${COLOR_KEY_VALUE(`winget install glab`)} `);
        else return COLOR_KEY_MESSAGE(` Please follow instruction at  https://github.com/profclems/glab#installation`);
    }

    public async raiseAPullRequest(workItem: WorkItem) {
        let pullRequestCommand = ` glab pr create --target-branch ${workItem.trackingBranch} --fill -draft`;
        let executor: ExecuteCommand = new ExecuteCommand();
        let result = (await executor.execCommand(pullRequestCommand, process.cwd())) as string;
        SFPLogger.log(result);
    }

    public async authenticate() {
        let pullRequestCommand = ` glab auth login`;
        child_process.execSync(pullRequestCommand, {
            encoding: 'utf8',
            stdio: 'inherit',
        });
    }
}
