---
description: Prepare a pool of just-in-time CI scratch orgs or Development Environments
---

# Prepare

Prepare command helps you to build a pool of prebuilt scratch orgs which include managed packages as well as packages in your repository. This process allows you to cut down time in re-creating a scratch org during validation process when a scratch org is used as just-in-time CI environment or when being used as a developer environment.

## Using scratch org as Developer Environments

Scratch orgs are one of the best features that Salesforce released, where they re-imagined the developer experience on the platform. Scratch orgs are ephemeral orgs that can be provisioned as a just-in-time environment, which can be populated with metadata and data from source control repository. This allows one to be in control of the metadata and data that needs to be provisioned in the orgs as opposed to sandboxes \(which are either a clone of another sandbox or created from production\). 

Scratch orgs helps to create environments at any specific point in time in your version control, and results in an interesting side effect, i.e. significant reduction in manual steps, as the whole objective is to get an org ready for development just from code.

## Using scratch orgs as Just in Time CI environments

The ability to quickly spin up an environment that is completely built from your source code repository, makes scratch orgs an ideal candidate for validating changes before merging pull requests. In this process, a freshly spun up scratch org could be used to deploy the metadata in your repository with the changes \( a PR process creates a temporary merge of the incoming branch along with current head of the target branch\), run apex tests, run UI tests etc. This addresses the following problems compared to using a sandbox for validation, especially in large programs.

* **Time consumed to spin a sandbox:** Developer sandbox still takes anywhere under 1 hour to create and activate a new environment. So it is not cost effective to provision sandboxes as a just-in-time disposable environment.   
* **CI Org getting corrupted:**  Due to the time taken to spin a sandbox for every run,  often a dedicated CI sandbox or an existing sandbox is re-purposed for validating incoming pull requests.  Due to the nature in software development for Salesforce, these sandbox typically tend to become corrupted due to unwanted deployments or configuration changes directly in the org.  As a result the changes must be manually fixed before being able to be use again as the CI org.   
* **Resource Contention:** Before scratch org's came into existence, typically a sandbox was used for validation run's. This means validation run's had to be queued up waiting for the CI environment to be free.  As a result, deployment queues on the sandbox may result in delays in validation error results.

## Building a pool of scratch orgs

As you try to automate more of your business processes in Salesforce, you cannot avoid adding third party managed packages as a dependency to your configuration metadata and code in your repository. The time required to spin up a just-in-time CI scratch org or even a developer environment \(one need to run data loading scripts, assign permission sets etc.\) would increase and the value of scratch org diminishes, as teams find it cumbersome.

This is the primary reason scratch org pools pre-installed with managed packages and your custom configuration and code, along with data from your repository will significantly enhance the developer experience. 

{% hint style="info" %}
The Prepare command was built primarily due to the delays from Salesforce to enable **snapshot** feature and make it GA to the public. However, even with snapshot feature, you might need to rebuild the snapshot every day, as we have noticed in a large mono repo scenario \(full deployment of metadata also takes long time\). We will modify the command as needed when this feature launches to utilize snapshot accordingly.
{% endhint %}

We expect you to build a pool of scratch org's using a pipeline at scheduled intervals, that ensures the pools are always replenished with scratch org's ready for consumption whenever you demand it.

{% hint style="info" %}
Note that to enable scratch org pooling, you will need to deploy some prerequisite fields to the ScratchOrgInfo Object in Dev Hub. The additional fields determine which pool a scratch org belongs to and also allows the validate and fetch commands to fetch scratch orgs from a pool. Instructions on how to install the prerequisite package that contains the fields are available [here](https://sfpowerscripts.dxatscale.io/getting-started/prerequisites).
{% endhint %}

## Steps undertaken by prepare command

The prepare command does the following sequence of activities

1. **Calculate the number of scratch orgs to be allocated** \(Based on your requested number of scratch orgs and your org limits, we calculate what is the number of scratch orgs to be allocated at this point in time\)
2. **Fetch the artifacts from registry if "fetchArtifacts" is defined in config, otherwise build all artifacts**
3. **Create the scratch orgs, and update Allocation\_status\_c of each these orgs to "In Progress"**
4. **On each scratch org, in parallel, do the following activities:**
   * Install SFPOWERSCRIPTS\_ARTIFACT\_PACKAGE \(04t1P000000ka9mQAA\) for keeping track of all the packages which will be installed in the org. You can set an environment variable SFPOWERSCRIPTS\_ARTIFACT\_PACKAGE to override the installation with your own package id \(the source code is available [here](https://github.com/Accenture/sfpowerscripts/tree/develop/prerequisites/sfpowerscripts-artifact)\)
   * Install all the dependencies of your packages, such as managed packages that are marked as dependencies in your sfdx-project.json
   * Install all the artifacts that is either built/fetched
   * If `enableSourceTracking` is specified in the configuration, create and deploy "sourceTrackingFiles" static resource to the scratch org. The static resource is retrieved to the local ".sfdx" directory, when using `sfpowerscripts:pool:fetch` to fetch a scratch org, and allows users to deploy their changes only, through source tracking. 
5. **Mark each completed scratch org as "Available"**
6. **Delete all the failed scratch orgs** - check **Why do some scratch org's fail during pool creation?** below

{% hint style="warning" %}
 **Ensure that your DevHub is authenticated using** [**SFDX Auth URL**](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference_auth_sfdxurl.htm) **and the auth URL is stored in a secure place \(Key Management System or Secure Storage\).**
{% endhint %}

## **Using pre-existing artifacts in Scratch Org Pools**

Building packages from source code during pooling takes a considerable amount of time, and there could be situations where the latest head is broken. Hence we recommend using the last-known successful build from the artifact repository. When the `installall` and `fetchArtifacts` configurations are specified, the user can either use **NPM** to fetch artifacts or define the path to a shell script containing the logic for fetching artifacts from a registry.  

{% hint style="info" %}
 If the `installall` configuration is specified without `fetchArtifacts`, then new packages will be built, from the checked-out source code, and installed in the scratch orgs.
{% endhint %}

## Fetching Scratch Orgs from pool

While scratch orgs created by prepare command will be automatically fetched by the validate command, for use as Just in time environments for validating an incoming change. Developers who need a scratch org from the pool must issue the fetch command on their terminal

```javascript
sfdx sfpowerscripts:pool:fetch -t <POOL_NAME> -v <devhub-alias> -a <scratchorg-alias>
```

Developers need sufficient permission in the associated DevHub to fetch a scratch org. Read more about associated permissions [here](https://sfpowerscripts.dxatscale.io/getting-started/prerequisites#grant-developers-access-to-scratch-org-pools).

{% hint style="warning" %}
When [Free Limited Access Licenses](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/dev_hub_license.htm) are being utilized, developers will not be able to delete the scratch orgs fetched from the pool \(due to permission restrictions\). It is recommended to build a pipeline in your CI/CD system that is run with elevated permission and license which could delete these scratch orgs.
{% endhint %}

{% hint style="info" %}
Please check the [prerequisites](../../getting-started/prerequisites.md) page to learn more about and the steps required to enable pooling in your DevHub
{% endhint %}

## Managing Package Dependencies

The Prepare command utilises `sfpowerkit:package:dependencies:install` under the hood to orchestrate installation of package dependencies. Package dependencies are defined in the sfdx-project.json. More information on defining package dependencies can be found in the Salesforce [docs](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev2gp_config_file.htm).

```javascript
{
  "packageDirectories": [
    {
      "path": "util",
      "default": true,
      "package": "Expense-Manager-Util",
      "versionName": "Winter ‘20",
      "versionDescription": "Welcome to Winter 2020 Release of Expense Manager Util Package",
      "versionNumber": "4.7.0.NEXT"
    },
    {
      "path": "exp-core",
      "default": false,
      "package": "ExpenseManager",
      "versionName": "v 3.2",
      "versionDescription": "Winter 2020 Release",
      "versionNumber": "3.2.0.NEXT",
      "dependencies": [
        {
          "package": "ExpenseManager-Util",
          "versionNumber": "4.7.0.LATEST"
        },
          {
          "package": "TriggerFramework",
          "versionNumber": "1.7.0.LATEST"
        },
        {
          "package": "External Apex Library - 1.0.0.4"
        }
      ]
    }
  ],
  "sourceApiVersion": "47.0",
  "packageAliases": {
    "TriggerFramework": "0HoB00000004RFpLAM",
    "Expense Manager - Util": "0HoB00000004CFpKAM",
    "External Apex Library@1.0.0.4": "04tB0000000IB1EIAW",
    "Expense Manager": "0HoB00000004CFuKAM"
  }
}
```

Let's unpack the concepts utilizing the above example:

* There are two unlocked packages
  * Expense Manager - Util is an unlocked package in your DevHub, identifiable by 0H in the packageAlias
  * Expense Manager - another unlocked package which is dependent on ' Expense Manager - Util', 'TriggerFramework' and  'External Apex Library - 1.0.0.4'
* External Apex Library is an external dependency, It could be a managed package or any unlocked package released on a different Dev Hub. All external package dependencies have to be defined with a 04t ID, which can be determined from the installation URL from AppExchange or by contacting your vendor.
* sfpowerscripts parses sfdx-project.json and does the following in order
  * Skips Expense manager - Util as it doesn't have any dependencies
  * For Expense manager
    * Checks whether any of the package is part of the same repo, in this example 'Expense Manager-Util' is part of the same repository and will not be installed as a dependency
    * Installs the latest version of TriggerFramework \( with major, minor and patch versions matching 1.7.0\) to the scratch org
    * Install the 'External Apex Library - 1.0.0.4' by utilizing the 04t id provided in the packageAliases

If any of the managed package has keys, it can be provided as an argument to the prepare command. Check the command's flags for more information.

### Key Support for Managed Packages

The format for the 'keys' parameter is a string of key-value pairs separated by spaces - where the key is the name of the package, the value is the protection key of the package, and the key-value pair itself is delimited by a colon .

e.g. `--keys "packageA:12345 packageB:pw356 packageC:pw777"`

{% hint style="warning" %}
The time taken by this command depends on how many managed packages and your packages that need to be installed. Please note, if you are triggering this command in a CI server, ensure proper time outs are provided for this task, as most cloud-based CI providers have time limits on how long a single task can be run.
{% endhint %}

## Handling a change in shape of pooled scratch orgs

For changes to the features and settings in pooled scratch orgs, check out the [validate command's documentation](../validate.md), which has information on how to dynamically update the shape of already created scratch orgs. Otherwise, the existing pool can be deleted and created again.

## Managing the Scratch Org pool

The `sfpowerscripts:pool` topic contains commands that can be used to manage \(list, fetch and delete\) the scratch org pools created by prepare command.

## Package checkpoints

Package checkpoints allow precise control over which scratch orgs are committed to a pool when there are deployment failures and the `succeedOnDeploymentErrors` configuration is specified. To designate a package as a checkpoint, add the property `checkpointForPrepare: true` to the package in the sfdx-project.json. Only scratch orgs that satisfy at least one checkpoint will be committed to the pool. This provides more consistency in what you can expect from your scratch orgs.

## Using Prepare with Non-NPM Registries

Unlike NPM registries, there is no uniform method for downloading artifacts from a universal registry, so you will need to provide a shell script that calls the relevant API. The path to the shell script should be specified in the pool configuration.

There are multiple parameters available in the shell script. Pass these parameters to the API call, and at runtime they will be substituted with the corresponding values:

1. Artifact name
2. Artifact version
3. Directory to download artifacts 

**Eg.** **Fetching from Azure Artifacts using the Az CLI on Linux**

```text
#!/bin/bash

# $1 - artifact name
# $2 - artifact version
# $3 - artifact directory 

echo "Downloading Artifact $1 Version $2"

az artifacts universal download --feed myfeed --name $1 --version $2 --path $3 \
    --organization "https://dev.azure.com/myorg/" --project myproject --scope project
```

## 

