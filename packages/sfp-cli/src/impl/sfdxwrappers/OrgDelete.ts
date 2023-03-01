import { SFDXCommand } from '@dxatscale/sfdx-process-wrapper/lib/SFDXCommand';


export default class OrgDelete extends SFDXCommand {
    public constructor(private aliasOrUsername?: string, private devHubUserName?: string) {
        super(null, null);
    }

    getSFDXCommand(): string {
        return 'sfdx force:org:delete';
    }

    getCommandName(): string {
        return 'OrgDelete';
    }

    getGeneratedParams(): string {
        let params = ` --targetusername ${this.aliasOrUsername} -p`;
        if (this.devHubUserName) params += `  --targetdevhubusername=${this.devHubUserName}`;
        return params;
    }
}
