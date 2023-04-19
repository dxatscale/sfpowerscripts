import PicklistEnabler from './PicklistEnabler';
import { PreDeployer } from './PreDeployer';

export class PreDeployersRegistry {
    static getPreDeployers(): PreDeployer[] {
        let preDeployers: PreDeployer[] = [];

        let picklistEnabler = new PicklistEnabler();
        preDeployers.push(picklistEnabler);

        return preDeployers;
    }
}
