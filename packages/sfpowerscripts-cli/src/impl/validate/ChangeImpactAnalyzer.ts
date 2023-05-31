import SFPOrg from "@dxatscale/sfpowerscripts.core/lib/org/SFPOrg";
import { DeploymentResult } from "../deploy/DeployImpl";
import SFPLogger from "@dxatscale/sfp-logger";
import ImpactAnalysis from "./ImpactAnalysis";
import { Analyzer } from "./Analyzer";

export class ChangeImpactAnalyzer extends Analyzer
{


  public constructor(baseBranch:string,
    private orgAsSFPOrg: SFPOrg,
		private deploymentResult: DeploymentResult) {
      super(baseBranch)
    }

    public async impactAnalysis() {
	
			const changedComponents = await this.getChangedComponents();
			try {
				const impactAnalysis = new ImpactAnalysis(
					this.orgAsSFPOrg.getConnection(),
					changedComponents,
				);
				await impactAnalysis.exec();
			} catch (err) {
				SFPLogger.log(err.message);
				SFPLogger.log("Failed to perform impact analysis");
			}
		
	}

}