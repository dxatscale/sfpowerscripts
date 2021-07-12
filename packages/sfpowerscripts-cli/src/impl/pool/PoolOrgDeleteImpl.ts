import { Org } from "@salesforce/core";
import { PoolBaseImpl } from "./PoolBaseImpl";
import DeleteScratchOrg from "@dxatscale/sfpowerscripts.core/lib/scratchorg/DeleteScratchOrg";
import ScratchOrgInfoFetcher from "./services/fetchers/ScratchOrgInfoFetcher";

export default class PoolOrgDeleteImpl extends PoolBaseImpl {
  username: string;

  public constructor(hubOrg: Org, username: string) {
    super(hubOrg);
    this.hubOrg = hubOrg;
    this.username = username;
  }

  protected async onExec(): Promise<void> {
    try {
      
      let scratchOrgId = await new ScratchOrgInfoFetcher(
        this.hubOrg
      ).getScratchOrgIdGivenUserName(this.username);
      await new DeleteScratchOrg(this.hubOrg).deleteScratchOrg(
        scratchOrgId
      );
    } catch (err) {
      throw new Error(
        `Either the scratch org doesn't exist or you do not have the correct permissions, Failed with ` +
          err.message
      );
    }
  }
}
