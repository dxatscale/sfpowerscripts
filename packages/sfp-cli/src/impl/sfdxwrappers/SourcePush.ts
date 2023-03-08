import { SFDXCommand } from '@dxatscale/sfdx-process-wrapper/lib/SFDXCommand';

export default class SourcePush extends SFDXCommand {
    public constructor(private targetOrg: string, private isForce: boolean) {
        super(null, null);
    }

    getSFDXCommand(): string {
        return 'sfdx force:source:push';
    }

    getCommandName(): string {
        return 'SourcePush';
    }

    getGeneratedParams(): string {
        let params = ` -u ${this.targetOrg}`;
        if (this.isForce) params += ` -f`;
        return params;
    }
}
