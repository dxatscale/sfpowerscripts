import { SFDXCommand } from '@dxatscale/sfdx-process-wrapper/lib/SFDXCommand';

export default class OrgList extends SFDXCommand {
    public constructor() {
        super(null, null);
    }

    getSFDXCommand(): string {
        return 'sfdx force:org:list';
    }

    getCommandName(): string {
        return 'OrgList';
    }

    getGeneratedParams(): string {
        return '';
    }
}
