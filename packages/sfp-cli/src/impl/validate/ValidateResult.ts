import { DeploymentResult, PackageInfo } from '../deploy/DeployImpl';
import DependencyViolation from '../../core/dependency/DependencyViolation';

export default interface ValidateResult {
    deploymentResult?: DeploymentResult;
    dependencyViolations?: DependencyViolation[];
    testFailures?: PackageInfo[];
}
