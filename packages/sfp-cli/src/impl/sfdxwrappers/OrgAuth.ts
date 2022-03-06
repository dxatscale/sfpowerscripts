import { SFDXCommand } from '@dxatscale/sfpowerscripts.core/lib/command/SFDXCommand';

export default class OrgAuth extends SFDXCommand {
    public constructor(private instanceURL?: string) {
        super(null, null);
    }

    getSFDXCommand(): string {
        return 'sfdx force:auth:web:login';
    }

    getCommandName(): string {
        return 'OrgAuth';
    }

    getGeneratedParams(): string {
        if (this.instanceURL) return ` --instanceurl ${this.instanceURL}`;
        else return '';
    }
}
