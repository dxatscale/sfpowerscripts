
import DeploymentExecutor, { DeploySourceResult } from "./DeploymentExecutor";
import PushSourceImpl from "../../sfdxwrappers/PushSourceImpl";

export default class PushSourceToOrgImpl implements DeploymentExecutor {

  constructor(
    protected target_org: string,
    protected project_directory: string,
  ) {}

  async exec(): Promise<DeploySourceResult> {
    try {
      await new PushSourceImpl(
        this.target_org,
        this.project_directory
      ).exec(true);

      return {
        deploy_id: null,
        result: true,
        message: "pushed successfully"
      }
    } catch (error) {
      return {
        deploy_id: null,
        result: false,
        message: error.message
      }
    }
  }

}