import AzureDevOps from './AzureDevOps';
import GitHub from './GitHub';
import Gitlab from './Gitlab';
import { RepoProvider } from './RepoProvider';

export default class RepoProviderSelector {
    static getRepoProvider(repoProvider: string): RepoProvider {
        switch (repoProvider) {
            case 'github':
                return new GitHub();
            case 'azure repo':
                return new AzureDevOps();
            case 'gitlab':
                return new Gitlab();
            case 'other':
                throw new Error('Invalid Selection');
        }
    }
}
