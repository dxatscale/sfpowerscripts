import { DeploymentCustomizer } from './DeploymentCustomizer';
import FHTEnabler from './FHTEnabler';
import FTEnabler from './FTEnabler';


export class PostDeployersRegistry {
    static getPostDeployers(): DeploymentCustomizer[] {
        let postDeployers: DeploymentCustomizer[] = [];

        //TODO: Make dynamic
        let fhtEnabler = new FHTEnabler();
        let ftEnabler = new FTEnabler();
        postDeployers.push(fhtEnabler);
        postDeployers.push(ftEnabler);

        return postDeployers;
    }
}
