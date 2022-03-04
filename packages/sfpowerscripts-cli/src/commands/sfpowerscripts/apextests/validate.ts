import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import ValidateApexCoverageImpl from '@dxatscale/sfpowerscripts.core/lib/sfpowerkitwrappers/ValidateApexCoverageImpl';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'validate_apex_coverage');

export default class ValidateApexCoverage extends SfpowerscriptsCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [`$ sfdx sfpowerscripts:apextests:validate -u scratchorg -t 80`];

    protected static requiresProject = true;
    protected static requiresUsername = false;
    protected static requiresDevhubUsername = false;

    protected static flagsConfig = {
        targetorg: flags.string({
            char: 'u',
            description: messages.getMessage('targetOrgFlagDescription'),
            default: 'scratchorg',
        }),
        testcoverage: flags.string({
            required: true,
            char: 't',
            description: messages.getMessage('testCoverageFlagDescription'),
        }),
        loglevel: flags.enum({
            description: 'logging level for this command invocation',
            default: 'info',
            required: false,
            options: [
                'trace',
                'debug',
                'info',
                'warn',
                'error',
                'fatal',
                'TRACE',
                'DEBUG',
                'INFO',
                'WARN',
                'ERROR',
                'FATAL',
            ],
        }),
    };

    public async execute() {
        try {
            const target_org: string = this.flags.targetorg;
            const test_coverage: string = this.flags.testcoverage;

            let validateApexCoverageImpl: ValidateApexCoverageImpl = new ValidateApexCoverageImpl(
                target_org,
                Number(test_coverage)
            );
            await validateApexCoverageImpl.exec();
        } catch (err) {
            console.log(err);
            process.exit(1);
        }
    }
}
