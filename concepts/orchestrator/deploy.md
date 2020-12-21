---
description: Deploy your packages to an org
---

# Deploy

## What does deploy command do?

## What are the sequence of steps the deploy command does?

## How do I skip a package from being deployed to an org?

Yes, you could use the `ignoreOnStage:[ "deploy" ]` property to mark which packages should be skipped by the deploy command. If you want a selective skip, that is skip a particular package being deployed to specific org, your could use the property `skipDeployOnOrgs: ["username/alias","username/alias"]` . If the username/alias passed as a flag to the command matches the array, then this package will be skipped on deployment

## 



