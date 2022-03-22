import { SFDXCommand } from '../command/SFDXCommand';

export default class PushSourceImpl extends SFDXCommand {
    constructor(protected target_org: string, protected project_directory: string, private waitTime: string = '60') {
        super(target_org, project_directory);
    }

    public getSFDXCommand(): string {
        return `sfdx force:source:beta:push`;
    }

    public getGeneratedParams(): string {
        return `-u ${this.target_org} -f -w ${this.waitTime}`;
    }

    public getCommandName() {
        return 'PushSourceToOrgImpl';
    }
}
