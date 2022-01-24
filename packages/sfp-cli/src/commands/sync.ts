import {flags} from '@oclif/command'
import inquirer = require('inquirer')
import SFPLogger, { LoggerLevel, ConsoleLogger, COLOR_KEY_MESSAGE, COLOR_KEY_VALUE, COLOR_WARNING } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import PushErrorDisplayer from "@dxatscale/sfpowerscripts.core/lib/display/PushErrorDisplayer";
import CommandsWithInitCheck from '../sharedCommandBase/CommandsWithInitCheck';
import simpleGit, { SimpleGit } from "simple-git";
import SourcePush from "../impl/sfdxwrappers/SourcePush";
import PickAnOrgWorkflow from '../workflows/org/PickAnOrgWorkflow';
import SourceStatus from "../impl/sfdxwrappers/SourceStatus";
import cli from "cli-ux";
import { WorkItem } from '../types/WorkItem';
import PulSourceWorkflow from '../workflows/source/PullSourceWorkflow';
import SourceStatusDisplayer from '../impl/displayer/SourceStatusDisplayer';
import SourceTrackingReset from '../impl/sfdxwrappers/SourceTrackingReset';
import SourceStatusWorkflow from '../workflows/source/SourceStatusWorkflow';
import CommitWorkflow from "../workflows/git/CommitWorkflow";
import SyncGit from "../workflows/sync/SyncGit";
import SyncOrg from "../workflows/sync/SyncOrg";

export default class Sync extends CommandsWithInitCheck {
  static description = 'sync changes effortlessly either with repository or development environment'

  static flags = {
    help: flags.help({char: 'h'})
  }

  async executeCommand() {

    let option = await this.promptAndCaptureOption();

    const git = simpleGit();
    if(option === 'sync-git')
    {
      await new SyncGit(git, this.sfpProjectConfig).execute();
    }
    else if(option === 'sync-org')
    {
      const branches = await git.branch();
      const workItem = this.sfpProjectConfig.getWorkItemGivenBranch(branches.current);

      //Only select org if there is no org available
      let devOrg: string;
      if(workItem?.defaultDevOrg == null) {
        SFPLogger.log(`  ${COLOR_WARNING(`Work Item not intialized, always utilize ${COLOR_KEY_MESSAGE(`sfp work`)} to intialize work`)}`)
        devOrg = await new PickAnOrgWorkflow().getADevOrg();
        //Reset source tracking when user picks up random orgs
        //await new SourceTrackingReset(devOrg).exec(true);
      } else {
        devOrg = workItem.defaultDevOrg
      }

      await new SyncOrg(git, this.sfpProjectConfig, devOrg).execute();
    }
  }

  private async promptAndCaptureOption(): Promise<string> {
    const optionPrompt = await inquirer.prompt([
      {
        type: "list",
        name: "option",
        message: "Select an option to proceed?",
        choices: [
          { name: "Sync local with remote repository",value:"sync-git"},
          { name: "Sync local with Dev Org",value:"sync-org"},
        ],
        default: "Sync local with remote repository"
      },
    ]);

    return optionPrompt.option;
  }
}
