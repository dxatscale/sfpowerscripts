import { Messages } from '@salesforce/core';
import sfpCommand from '../../SfpCommand';
import SFPLogger, {
    LoggerLevel,
    Logger,
    ConsoleLogger,
    COLOR_HEADER,
    COLOR_KEY_MESSAGE,
    COLOR_ERROR,
} from '@flxblio/sfp-logger';
import { Flags } from '@oclif/core';
import { loglevel } from '../../flags/sfdxflags';
import { deactivate, deleteFlows, getFlowDefinition, getFlowsByDefinition } from '../../core/flows/FlowOperations';
import { requiredUserNameFlag } from '../../flags/sfdxflags';
import SFPOrg from '../../core/org/SFPOrg';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@flxblio/sfp', 'flow');

export default class Cleanup extends sfpCommand {
    public static description = messages.getMessage('cleanupDescription');

    protected sfpOrg: SFPOrg;

    protected static requiresUsername = true;
    protected static supportsDevhubUsername = true;
    protected static requiresProject = false;

    public static flags = {
        developername: Flags.string({
            char: 'f',
            description: messages.getMessage('developernameFlagDescription'),
        }),
        namespaceprefix: Flags.string({
            char: 'p',
            description: messages.getMessage('namespacePrefixFlagDescription'),
        }),
        targetorg: requiredUserNameFlag,
        loglevel,
    };

    public async execute() {
        SFPLogger.log(COLOR_HEADER(`command: ${COLOR_KEY_MESSAGE(`flow:cleanup`)}`), LoggerLevel.INFO);
        const { developername, namespaceprefix } = (this.flags as unknown) as {
            developername: string;
            namespaceprefix: string;
        };
        this.sfpOrg = await SFPOrg.create({ aliasOrUsername: this.flags.targetorg });

        try {
            const flowdefinition = await getFlowDefinition(
                {
                    developername,
                    namespaceprefix,
                },
                this.sfpOrg,
                new ConsoleLogger()
            );
            //discover the active version of the flow
            if (flowdefinition.ActiveVersionId) {
                SFPLogger.log(
                    `Successfully discovered  the active version of  flow ${developername}: ${flowdefinition.ActiveVersionId}`,
                    LoggerLevel.INFO
                );
            }

            let flows = await getFlowsByDefinition(flowdefinition, this.sfpOrg, new ConsoleLogger());
            let succeededFlowIds = [];
            if (flows && flows.length > 0) {
                flows = flows.filter((flow) => flow.Id != flowdefinition.ActiveVersionId);
                succeededFlowIds = await deleteFlows(flows, this.sfpOrg, new ConsoleLogger());
            }
            // do a comparison of the requested flows and succeeded flows
            const flowIds = flows.map((flow) => flow.Id);
            const failedFlowIds = flowIds.filter((flowId) => !succeededFlowIds.includes(flowId));
            if (failedFlowIds.length > 0) {
                throw new Error(
                    `Failed to delete the following flow versions: ${failedFlowIds.join(
                        ', '
                    )}, You may need to try again or manually delete them from the org.`
                );
            }

            SFPLogger.log(`Successfully cleaned up the flow ${developername}`, LoggerLevel.INFO);
        } catch (error) {
            throw new Error(COLOR_ERROR('Unable to cleanup flow:' + error.message));
        }
    }
}
