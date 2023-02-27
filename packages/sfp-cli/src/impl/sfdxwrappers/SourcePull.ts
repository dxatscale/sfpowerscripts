import { SFDXCommand } from '@dxatscale/sfpowerscripts.core/lib/command/SFDXCommand';

export default class SourcePull extends SFDXCommand {
    public constructor(private targetOrg: string, private isForce: boolean) {
        super(null, null);
    }

    getSFDXCommand(): string {
        return 'sfdx force:source:pull';
    }

    getCommandName(): string {
        return 'SourcePull';
    }

    getGeneratedParams(): string {
        let params = ` -u ${this.targetOrg}`;
        if (this.isForce) params += ` -f`;
        return params;
    }
}
