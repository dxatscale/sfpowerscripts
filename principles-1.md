---
description: Guiding principles followed by the project
---

# Principles

## Utilize your Salesforce deployment knowhow

The tasks or commands should be easy to use.  You don't need to resort to complex scripts to  build a pipeline . A knowledge of what you need to achieve from a pipeline and salesforce development \(such as  Salesforce DX, Unlocked Package/Org Based deployment model or  a hybrid where you combine both\*\) should be enough to get you going.

We will also strive to provide sample pipelines to quickly get you started. Our azure pipelines extension is built with the classic \(UI based\) configuration in mind.

\*If you need a refresher on Salesforce DX, Unlocked Packages or Org Based Deployment, checkout some of the available trailhead modules [here](https://trailhead.salesforce.com/en/users/azlam/trailmixes/salesforce-dx)

## Integrate with CI/CD platform wherever applicable

The native extensions provided by the project will integrate with CI/CD platform features wherever applicable, rather than providing our own dashboards/reports or rolling out features that break the platform conventions.

## Everything is a package

sfpowerscripts \(cli/azure pipelines\) is built on the concept of generating artifacts for package creation tasks, unlocked or not, which then could be versioned, uploaded into an artifact provider or utilized in subsequent stages for deployment into various environments 

The following package creation commands shows this in action

* Create Source Package
* Create Unlocked Package
* Create Delta Package
* Create Data Package \(for Records Based Configuration\)



![Use of artifacts across different stages](.gitbook/assets/build-deploy.png)

These commands create an artifact named`<package_name>_sfpowerscripts_artifact_<ver>.zip`. This zip file contains the following items

| Item | Description |
| :--- | :--- |
| artifact\_metatadata.json | A JSON based manifest that contains information about the package |
| changelog.json | A JSON based schema that carries all commit description about the package |
| source | A directory containing the metadata in source format  |

## Optimized for Speed without hampering traceability

One of the common questions that is often asked to us, does deploying packages compared to delta deployments \( deploys only what is changed between two commits or a range of commits\) make the overall deployment slower? 

As packages are always deployed in its entirety, this is an understood fact. sfpowerscripts will always be built with features to optimize for speed but still ensuring the org is traceable compared to happy soup

Features currently enabling this principle include 

* ,All sfpowerscripts package creation commands feature a diff check, which builds the package only if it detects a change. 
* Packages will only be installed in the org, if the given package is not installed in the org
* Support for mono repository, while working with multiple packages reduces overhead

Of course the onus is on developers to granularize packages, so that this could be achieved, but be assured the tooling is available.



