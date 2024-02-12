import { DeploymentFilter  } from './DeploymentFilter';
import EntitlementVersionFilter from './EntitlementVersionFilter';
import FlowVersionFilter from './FlowVersionFilter';




export class DeploymentFilterRegistry {
    static getImplementations(): DeploymentFilter[] {
        let deploymentFilterImpls: DeploymentFilter[] = [];

        //TODO: Make dynamic
        let entitlementVersionFilter = new EntitlementVersionFilter();
        deploymentFilterImpls.push(entitlementVersionFilter);
        deploymentFilterImpls.push(new FlowVersionFilter());
        
        
        return deploymentFilterImpls;
    }
}
