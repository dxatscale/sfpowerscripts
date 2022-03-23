import { WorkItem } from '../../types/WorkItem';

export interface RepoProvider {
    name(): string;

    isCLIInstalled(): Promise<boolean>;

    getInstallationMessage(platform: string): string;

    raiseAPullRequest(workItem: WorkItem);

    authenticate();
}
