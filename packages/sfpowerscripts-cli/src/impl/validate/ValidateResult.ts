import { DeploymentResult } from "../deploy/DeployImpl";
import DependencyViolation from "@dxatscale/sfpowerscripts.core/lib/dependency/DependencyViolation";

export default interface ValidateResult {
  deploymentResult: DeploymentResult,
  dependencyViolations?: DependencyViolation[]
}