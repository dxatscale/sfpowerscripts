import FHTEnabler from './FHTEnabler';
import { PostDeployer } from './PostDeployer';

export class PostDeployersRegistry {
    static getPostDeployers(): PostDeployer[] {
        let postDeployers: PostDeployer[] = [];

        //TODO: Make dynamic
        let fhtEnabler = new FHTEnabler();
        postDeployers.push(fhtEnabler);

        return postDeployers;
    }
}
