import { SimpleGit } from 'simple-git/promise';

export default class GitIdentity {
    constructor(private git: SimpleGit) {}

    async setUsernameAndEmail(): Promise<void> {
        await this.setUsername();
        await this.setEmail();
    }

    private async setUsername(): Promise<void> {
        let username: string;

        if (process.env.SFPOWERSCRIPTS_GIT_USERNAME) {
            username = process.env.SFPOWERSCRIPTS_GIT_USERNAME;
        } else {
            username = 'sfpowerscripts';
        }

        await this.git.addConfig('user.name', username);
    }

    private async setEmail(): Promise<void> {
        let email: string;

        if (process.env.SFPOWERSCRIPTS_GIT_EMAIL) {
            email = process.env.SFPOWERSCRIPTS_GIT_EMAIL;
        } else {
            email = 'sfpowerscripts@dxatscale.io';
        }

        await this.git.addConfig('user.email', email);
    }
}
