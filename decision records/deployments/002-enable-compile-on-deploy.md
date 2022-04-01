# Enabling Synchronous Compile on Deploy

- Status: Proposed
- Issue: N/A
- Reference: Addresses some concerns in #836

## Context and Problem Statement

DX@Scale implementations typically do not use synchronous compile on deploy for source packages nor doesn't use ```--apexcompile=all``` while installing a package to lower environments(sandbox) unless explicitly enabled. This has uncovered some scenarios on larger orgs.

- Specified test executions are triggered asynchronously by default, unless the org is set to disable parallel testing. This results in each test class being executed in parallel. On large code bases, this results in the situation where code coverage of some test classes are skipped due to 'Code coverage from running this test class was not applied due to a conflicting recompilation task running at the same time'. Analysis using multiple runs with 'Disable parallel testing in org' seemed to resolve this issue for most runs (9/10 worked successfully). As a note, Salesforce disables parallel testing during package:version:create as well as during deployment to production for source packages (where apex classes are deployed with specified test classes)

- Deployment to lower environments not accurate enough of what's happening in production

  sfpowerscripts report various metrics about installation time of a package across various environments. These numbers can be misleading when compared to the time it takes to install in production, as Salesforce overrides the behavior of installation of a package. Salesforce have confirmed the following
  - A full Org-wide compile may be initiated after every deployment, regardless of options/flags used as part of that deployment. Whether the compilation is executed is based on what's in the package that (code or config) invalidates the byte code.
  - The deployment of multiple unlocked packages is treated as multiple separate deployments (not one large deployment containing multiple packages), and so the deployment of multiple packages as part of a release may initiate multiple re-compiles, which with many packages creates significant overhead
  - This behavior is always enabled in production, but optional in sandboxes, hence the reason for the difference in timings between those environments

- Rare instances of packages failing to deploy in production due to compilation errors

  Though the chance to fail are minimal on orgs that have fully adopted DX@Scale model, where Scratch Orgs are predominantly utilized for development and validation, it can occur in Brownfield orgs which are on a path to refactoring and the errors are noted during production deployments.

## Implementation Options

### 1. Allow users to decide the course of action

   sfpowerscripts will not provide any additional features. The users would activate `enableCompileOnDeploy=true` in scratch org definition or other means such as deploying it as a pre-installation script. The same can also be activated in individual sandboxes as well.

#### Pros

- Non-opinionated, Good flexibility, helps the user to decide what they want

#### Cons

- Enabling on scratch orgs through definition can make preparation of scratch orgs during prepare slower, where this setting need not be activated. Hence, additional scratch org definition should be maintained
- Use of additional scripting to enable this setting as a pre-installation script
- Relatively obscure setting, with minimal documentation. Users will struggle with an issue resolution when they start to see the issue cropping up

### 2. Enhance sfpowerscripts with defaults
  
sfpowerscripts will feature the following defaults:

- Prepare will enable synchronous compile on deploy as a default option for non source tracked pools. Pool configuration will have a new flag which can toggle on/off this setting. This will be executed as the last step before a scratch org is added to the pool. This ensures prepare continues with the same speed as of now.
- Deploy will enable synchronous compile on deploy to sandboxes unless turned off by a newly introduced flag. Package installation will also utilize ```---apexCompile=all``` as the default option. Deploy command will check the status of the setting and will execute it before installing any packages
- Release will follow the same option as deploy (as its basically deploy under the hood), but this functionality can be toggled through the release definition

#### Pros

- No intervention required from the users
- Safe defaults prevent issues from being surfaced later
  
#### Cons

- sfpowerscripts have so far stayed from dynamic configuration of the org. This may confuse users who have not read the documentation
- Users who are refactoring into packages have to explicitly turn this off in the early stages, as its quite common that in larger happy soup orgs, sandboxes are mostly in a non-compilable shape
- Increased duration of installation of a package can frustrate developers during onboarding to dx@scale

## Decision

- After monitoring multiple runs, it was found that `enableCompileOnDeploy` didn't really solve the code coverage issues. So this functionality  doesnt immediately provide  any value other than making it deployments slower. It will be left to the user to determine the course of action, users could enable this setting through a scratch org definition or by making the change in sandbox through UI. sfpowerscripts will provide an option to install unlocked packages with ```apexCompile==all``` on specific orgs (as defined ) in release definition 
