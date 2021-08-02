---
description: The following pre-requisites are required for sfpowerscripts to work
---

# Prerequisites

## **Understanding of Salesforce DX and Packaging in general**

To get the maximum benefit out of sfpowerscripts, you need a good understanding of GIT, Salesforce DX and packaging in general. Here are some links to get you started

1. [Trailhead Modules](https://trailhead.salesforce.com/en/users/azlam/trailmixes/salesforce-dx)  
2. [Adopting Package Based Development Model in Salesforce](https://www.linkedin.com/pulse/adopting-package-based-development-model-salesforce-azlam-abdulsalam/?trk=read_related_article-card_title)

## Enable Dev Hub and Unlocked Packaging

Package-based development is the preferred workflow of DX@Scale, where scratch orgs are used as a development environment, CI environment for validating changes, and internally by Salesforce to create unlocked packages. To enable these use cases,  Dev Hub \(Setup -&gt; Dev Hub -&gt; Enable Dev Hub\) and Unlocked Packages \(Setup -&gt; Dev Hub -&gt; Enable Unlocked Packages and Second-Generation Managed Packages \) must be enabled in the production environment.

## Create a CI service user in production

It is best practice to have a service user execute tasks in the CICD, rather than using a personal user account. The service user should be created as a System Administrator, so that it has permission to manage scratch orgs and unlocked packages. A group email address may be assigned to the service user, if controlled by multiple people in a team. 

## Authenticate CI service user using SFDX Auth URL

The preferred method of authenticating to Dev Hub for the CI service user is through SFDX Auth URL. This method of authentication is essential when creating scratch org pools.

To retrieve the SFDX Auth URL:

1. Login to Dev Hub with the CI service user, using web auth:
   1. `sfdx force:auth:web:login -r https://login.salesforce.com`
2. Run the `force:org:display` command with the `--verbose` and `–json` flags
   1. `sfdx force:org:display -u CIServiceUser –verbose –json`
3. Copy the value of the SFDX Auth URL field into CICD secrets

For more information on SFDX Auth URL, visit the Salesforce [documentation](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference_auth_sfdxurl.htm).

## Install prerequisite packages

The scratch org pooling feature and ability to skip repeated deployments of the same package version, are dependent on the additional metadata contained in prerequisite packages. The packages have been created on an Accenture org and their Subscriber Package Version Id’s are publicly available; however, you may wish to create the packages on your own Dev Hub, from the source code.

#### Prerequisite packages:

* [sfpowerscripts-artifact](https://github.com/Accenture/sfpowerscripts/tree/develop/prerequisites/sfpowerscripts-artifact) \(unlocked\)



  Creates a `SfpowerscriptsArtifact__c` custom setting that has records of the sfpowerscripts artifacts that have been installed in the org. Allows for optimised deployments by only deploying artifacts that are not already on the org.

* [scratch org pooling](https://github.com/Accenture/sfpowerscripts/tree/develop/prerequisites/scratchorgpool) \(org-dependent\)



  Adds additional fields to the ScratchOrgInfo object to allow for the creation of scratch org pools. Utilised by the `sfdx sfpowerscripts:orchestrator:prepare` command to create CI scratch orgs. 

#### Create packages from source code

1. Create a new project from the prerequisite package's directory
2. Authenticate to Dev Hub in your terminal

   `sfdx force:auth:web:login -r https://login.salesforce.com -a myDevHub`

3. Create the package in Dev Hub

   `sfdx force:package:create -n packageName -r path/to/package -t Unlocked -v myDevHub`

   The package name and path are defined in the sfdx-project.json. Running this command will add the package 0H ID as a package alias to the sfdx-project.json.

   **Note: The scratch-org pool package must be created as an org-dependent package by passing the additional flag** `--orgdependent`

4. Create a new version of the package in Dev Hub

   `sfdx force:package:version:create -p packageAlias -f config/project-scratch-def.json -v myDevHub -w 60 -x -c` 

   This command will create a subscriber package version Id in the Dev Hub, which can be used to install the package in orgs on the release train.

5. Promote the package version in Dev Hub

   `sfdx force:package:version:promote -p 04t** -v myDevHub`

6. Install the package in orgs on the release train

   `sfdx force:package:install -p subscriberPackageVersionId -u myOrg -w 60`

   **Note: The scratch-org pool package should only be installed in production and not in sandboxes**

7. Push the changes to the sfdx-project.json, to your hosted git repository

## Grant developers access to scratch org pools

For developers to access scratch orgs created by the CI service user, for their local development, a sharing setting needs to be created on the ScratchOrgInfo object. The sharing setting should grant read/write access to the ScratchOrgInfo records owned by a public group consisting of the CI service user and a public group consisting of the developer users.  

Create two public groups

1. CI Users \(Admin users/ CI users who creates scratch orgs in pool\)
2. Developers \(developers who are allowed to fetch scratch orgs from pool\), 

Then create a sharing rule that grant read/write access to the ScratchOrgInfos records owned by the CI Users to Developers

The developers must also have object-level and FLS permissions on the ScratchOrgInfo object. One way to achieve this is to assign a permission set that has Read, Create, Edit and Delete access on ScratchOrgInfos, as well as Read and Edit access to the custom fields used for scratch org pooling: `Allocation_status__c`, `Password__c`, `Pooltag__c` and `SfdxAuthUrl__c`.

## **On your CI/CD**

[sfdx-cli ](https://www.npmjs.com/package/sfdx-cli): sfpowerscripts is a SFDX CLI extension. Hence require the latest version of sfdx-cli installed in your CI/CD agents

```text
$ npm i sfdx-cli --global
```

* [sfpowerkit ](https://github.com/accenture/sfpowerkit):  sfdx plugin that has variety of helper commands, sfpowerscripts uses sfpowerkit for various functionality such as reconciling profiles. 

```text
$ echo'y' | sfdx plugins:install sfpowerkit
```

* [sfdmu ](https://github.com/forcedotcom/SFDX-Data-Move-Utility): sfdx plugin that helps in data migration between orgs or between source to orgs. sfpowerscripts utilizes sfdmu for data package

```text
$ echo'y' | sfdx plugins:install sfdmu
```

* [sfpowerscripts](https://www.npmjs.com/package/@dxatscale/sfpowerscripts):  Install the sfpowerscripts sfdx-cli plugin from npm

```text
$ echo'y' | sfdx plugins:install @dxatscale/sfpowerscripts
```

Alternatively, you could use our [docker](docker.md) image and we highly recommend to utilize it.

\*\*\*\*

## **Artifact Registry**

sfpowerscripts is designed to work with [asynchronous pipelines](https://dxatscale.gitbook.io/sfpowerscripts/faq/orchestrator#is-there-a-pipeline-schematic-diagram-that-i-can-understand), where CI and CD is separated into two distinct pipelines. This means an artifact repository/registry such as Azure Artifacts, Jfrog Artifactory is essential to store the built artifacts

## **Monitoring Service \(Highly Recommended\)**

Metrics should be a key part of your DevOps process. It is through these metrics, one can drive continuous improvement of your delivery process. Almost all commands in sfpowerscripts, is instrumented with StatsD. sfpowerscripts also feature native integration to DataDog, NewRelic and also generates log based metrics which can be integrated to any monitoring service to build dashboards

You will need a StatsD server reachable from your CI/CD agent to report the metrics. Read more on supported metrics and dashboards [here](../faq/metrics-and-dashboards.md).

