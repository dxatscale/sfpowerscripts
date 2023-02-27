import { SFDXCommand } from '@dxatscale/sfpowerscripts.core/lib/command/SFDXCommand';

export default class SourceStatus extends SFDXCommand {
    public constructor(private targetOrg: string) {
        super(null, null);
    }

    getSFDXCommand(): string {
        return 'sfdx force:source:status';
    }

    getCommandName(): string {
        return 'SourceStatus';
    }

    getGeneratedParams(): string {
        return ` -u ${this.targetOrg}`;
    }
}
