import { DeploymentCustomizer } from './DeploymentCustomizer';
import PicklistEnabler from './PicklistEnabler';


export class PreDeployersRegistry {
    static getPreDeployers(): DeploymentCustomizer[] {
        let preDeployers: DeploymentCustomizer[] = [];

        let picklistEnabler = new PicklistEnabler();
        preDeployers.push(picklistEnabler);

        return preDeployers;
    }
}
