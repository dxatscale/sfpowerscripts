import { SFDXCommand } from '@dxatscale/sfpowerscripts.core/lib/command/SFDXCommand';

export default class SourceTrackingReset extends SFDXCommand {
    public constructor(private targetOrg: string) {
        super(null, null);
    }

    getSFDXCommand(): string {
        return 'sfdx force:source:tracking:reset';
    }

    getCommandName(): string {
        return 'SourceTrackingReset';
    }

    getGeneratedParams(): string {
        return ` -u ${this.targetOrg} -p`;
    }
}
