import cli from 'cli-ux';
import SourceStatus from '../../impl/sfdxwrappers/SourceStatus';
import SourceStatusDisplayer from '../../impl/displayer/SourceStatusDisplayer';

export default class SourceStatusWorkflow {
    public constructor(private targetOrg: string) {}

    public async execute() {
        let statusResult;

        cli.action.start(`  Checking for changes in  dev org ${this.targetOrg}..`);
        let result = await new SourceStatus(this.targetOrg).exec(true);
        cli.action.stop();

        statusResult = result.map((elem) => {
            if (elem.fullName.includes('/')) {
                elem['parentFolder'] = elem.fullName.split('/')[0];
            }
            return elem;
        });

        new SourceStatusDisplayer(statusResult).display();

        return statusResult;
    }
}
