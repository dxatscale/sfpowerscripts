import { DeploymentFilter  } from './DeploymentFilter';
import EntitlementVersionFilter from './EntitlementVersionFilter';




export class DeploymentFilterRegistry {
    static getImplementations(): DeploymentFilter[] {
        let deploymentFilterImpls: DeploymentFilter[] = [];

        //TODO: Make dynamic
        let entitlementVersionFilter = new EntitlementVersionFilter();
        deploymentFilterImpls.push(entitlementVersionFilter);
        
        
        return deploymentFilterImpls;
    }
}
