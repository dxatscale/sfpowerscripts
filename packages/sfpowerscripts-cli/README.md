# sfpowerscripts

A Salesforce build system for package based development as a sfdx plugin that can be implemented in any CI/CD system of choice. Read more about the plugin and details here - <https://docs.dxatscale.io/projects/sfpowerscripts>

- Features
  - Orchestrator, which utilizes sfdx-project.json as the source of truth for driving the build system, ensuring very low maintenance on programs often dealing with multiple number of packages
  - Builds packages in parallel by respecting dependencies
  - Ability to selectively build changed packages in a mono repo
  - Ability to deploy only packages that are changed in repo
  - Pooling commands to prepare a pool of scratch org's with packages pre-installed for optimized Pull/Merge Request validation
  - Artifacts Driven, all create commands produce an artifact or operate on an artifact
  - Integrate with any CI/CD system of choice
  - Support for external scripts, as hooks making integration easy
