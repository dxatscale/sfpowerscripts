import { Messages } from '@salesforce/core';
import sfpCommand from '../../SfpCommand';
import SFPLogger, { LoggerLevel, Logger, ConsoleLogger, COLOR_HEADER, COLOR_KEY_MESSAGE, COLOR_ERROR } from '@flxblio/sfp-logger';
import { Flags } from '@oclif/core';
import { loglevel } from '../../flags/sfdxflags';
import {deactivate, deleteFlows, getFlowDefinition, getFlowsByDefinition} from '../../core/flows/FlowOperations';
import { requiredUserNameFlag } from '../../flags/sfdxflags';
import SFPOrg from '../../core/org/SFPOrg';


// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@flxblio/sfp', 'flow');

export default class Delete extends sfpCommand {
    public static description = messages.getMessage('deleteDescription');

    protected sfpOrg: SFPOrg;


    protected static requiresUsername = true;
    protected static supportsDevhubUsername = true;
    protected static requiresProject = false;

    public static flags = {
        developername: Flags.string({
            char: 'f',
            description: messages.getMessage('developernameFlagDescription')
        }),
        namespaceprefix: Flags.string({
            char: 'p',
            description: messages.getMessage('namespacePrefixFlagDescription')
        }),
        targetorg: requiredUserNameFlag,
        loglevel
    };

    public async execute() { 
     SFPLogger.log(COLOR_HEADER(`command: ${COLOR_KEY_MESSAGE(`flow:delete`)}`),LoggerLevel.INFO);
      const { developername, namespaceprefix } = this.flags as unknown as {
        developername: string;
        namespaceprefix: string;
      };
      this.sfpOrg = await SFPOrg.create({aliasOrUsername:this.flags.targetorg});

      try {
        const flowdefinition = await getFlowDefinition(
          {
            developername,
            namespaceprefix,
          },
          this.sfpOrg,
          new ConsoleLogger()
        );
        if (flowdefinition.ActiveVersionId) {
          await deactivate(flowdefinition, this.sfpOrg);
          SFPLogger.log(`Successfully deactivated the flow ${developername}`,LoggerLevel.INFO);
        }

        const flows = await getFlowsByDefinition(flowdefinition, this.sfpOrg, new ConsoleLogger());
        if (flows && flows.length > 0) {
          await deleteFlows(flows, this.sfpOrg,new ConsoleLogger());
        }

        SFPLogger.log(`Successfully deleted the flow ${developername}`,LoggerLevel.INFO);
          

      } catch (error) {
          throw new Error(COLOR_ERROR('Unable to delete flow:' + error.message));
      }
    }
}
