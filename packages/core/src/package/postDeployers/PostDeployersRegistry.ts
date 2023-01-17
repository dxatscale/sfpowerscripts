import FHTEnabler from './FHTEnabler';
import FTEnabler from './FTEnabler';
import { PostDeployer } from './PostDeployer';

export class PostDeployersRegistry {
    static getPostDeployers(): PostDeployer[] {
        let postDeployers: PostDeployer[] = [];

        //TODO: Make dynamic
        let fhtEnabler = new FHTEnabler();
        let ftEnabler = new FTEnabler();
        postDeployers.push(fhtEnabler);
        postDeployers.push(ftEnabler);

        return postDeployers;
    }
}
