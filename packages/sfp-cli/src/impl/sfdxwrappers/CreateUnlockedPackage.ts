import { SFDXCommand } from '@dxatscale/sfdx-process-wrapper/lib/SFDXCommand';

export default class CreateUnlockedPackage extends SFDXCommand {
    public constructor(
        private devhub: string,
        private packageInfo: { type: string; description: string; path: string; name: string }
    ) {
        super(null, null);
    }

    getSFDXCommand(): string {
        return 'sfdx force:package:create';
    }

    getCommandName(): string {
        return 'packageCreate';
    }

    getGeneratedParams(): string {
        let params = ` -v ${this.devhub}`;

        if (this.packageInfo.type === 'org-unlocked') params += ` --orgdependent`;

        params += ` --packagetype=Unlocked`;

        params += ` --nonamespace`;

        params += ` --name=${this.packageInfo.name}`;

        params += ` --description="${this.packageInfo.description}"`;

        params += ` --path=${this.packageInfo.path}`;

        return params;
    }
}
