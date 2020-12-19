---
description: >-
  Prepare a pool of scratch org's for validating incoming changes acting as a
  just in time CI server
---

# Prepare

## Why do I need to use Scratch Orgs for running tests?

Scratch Org's are one of the best features that Salesforce released, when they re-imagined the Developer experience with the platform. Scratch Org's are ephemeral org's  that can be provisioned as a  just in time environment, which can the be populated with metadata and data from your version controlled repository.

The Just in Time aspect of creation and  an org completely built from your source code repository , makes it an ideal candidate for using as an environment to validate changes before merging through a pull request process. In this process, a freshly spun up scratch org could be used to deploy the metadata in your repository with the changes \( a PR process creates a temporary merge of the incoming branch along with current head of the target branch\) , run apex tests, run UI tests  etc. This solves the following problems compared to using a sandbox for validation, especially in large programs.  
- **Time taken to spin a sandbox:** Developer sandbox still takes anywhere under 1 hour to create a provision a new environment. So it is not cost effective to provision sandboxes as a just in time disposable environment.  
- **CI Org getting corrupted:**  Due to the time taken to spin a sandbox for every run,  an existing sandbox was repurposed for validating incoming requests, this could potentially result in corrupting the org when a bad change get deployed.  This has then to be manually cleaned up.  
- **Resource Contention:** Before scratch org's came into existence, typically a sandbox was used for validation run's. this means validation run's had to be queued up waiting for the CI environment to be free.

## I get the benefits of using Scratch Org, Why should I be building a pool of Scratch Orgs?

As you add more and more features into your Salesforce Org, you cannot avoid adding third party managed packages and also your own repository will be growing. The time taken to spin up the scratch org will be increasing day by day, hence the need to prepare a pool of scratch org's with your managed packages along with metadata in your repository. 

## How is different from the upcoming snaphsot feature?

Prepare command was built  in, as Salesforce is taking its sweet time to enable this feature. However even with snapshot feature, you might need to rebuild the snapshot every day, as we have noticed in a large  mono repo scenario \(full deployment of metadata also takes a sweet time\). We will modify the command when this feature launches to utilize snapshot.

## How should I be using this command?

We expect you to build a pool of scratch org's using a scheduled pipeline, that ensures the pools are always replenished with scratch org's ready for consumption

## What is "artifactfetchScript" and how do I go about using it?

Its a hook to run a script that would be used to fetch sfpowerscripts artifact from an artifact repository when used with install all command.  The script will be provided with artifact_name  \(name of the package\) and arifact_\_directory \( the directory where the artifact should be placed\) . It is the responsibility of the script to provide with the right version of the artifact. We usually recommend using the latest test and validate version of the artifacts installed as source packages to the scratch org.

## How do I manage these Scratch Org\(s\) created by the pool command, such as deleting a pool?

You can use the sfpowerscripts:pool topic to manage the scratch org pools created by prepare command



