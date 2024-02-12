import { DeploymentCustomizer } from './DeploymentCustomizer';
import FHTEnabler from './FHTEnabler';
import FTEnabler from './FTEnabler';
import FlowActivator from './FlowActivator';


export class PostDeployersRegistry {
    static getPostDeployers(): DeploymentCustomizer[] {
        let postDeployers: DeploymentCustomizer[] = [];

        //TODO: Make dynamic
        let fhtEnabler = new FHTEnabler();
        let ftEnabler = new FTEnabler();
        let flowActivator = new FlowActivator();
        postDeployers.push(fhtEnabler);
        postDeployers.push(ftEnabler);
        postDeployers.push(flowActivator);

        return postDeployers;
    }
}
