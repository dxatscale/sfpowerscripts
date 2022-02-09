import cli from "cli-ux";
import { ConsoleLogger, COLOR_KEY_VALUE } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import SourcePush from "../sfdxwrappers/SourcePush";
import PushErrorDisplayer from "@dxatscale/sfpowerscripts.core/lib/display/PushErrorDisplayer";

export default class PushSourceToOrg {

  constructor(private devOrg: string) {}

  async exec() {
    try {
      cli.action.start(`  Pushing source to org ${COLOR_KEY_VALUE(this.devOrg)}`);
      await new SourcePush(this.devOrg, true).exec();
      cli.action.stop();
    } catch (error) {
      PushErrorDisplayer.printMetadataFailedToPush(JSON.parse(error.message), new ConsoleLogger());
      throw new Error("Failed to push source");
    }
  }
}
