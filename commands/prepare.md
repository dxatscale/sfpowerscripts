---
description: Prepare a pool of just in time CI server
---

# Prepare

Prepare command helps you to build a pool of prebuilt scratch orgs which include managed packages as well as packages in your repository. This process allows you to considerably cut down time in re-creating a scratch org during validation process when a scratch org is used as Just-in-time CI environment.

{% hint style="danger" %}
Please note that you should still build your own pipeline to provision scratch orgs for your developers to work on stories by using [**sfpowerkit pool**](https://github.com/Accenture/sfpowerkit#sfpowerkitpoolcreate) related commands.
{% endhint %}

## Using scratch org's as CI environments

Scratch Org's are one of the best features that Salesforce released, when they re-imagined the Developer Experience with the platform. Scratch Org's are ephemeral org's that can be provisioned as a just-in-time environment, which can be populated with metadata and data from your source control repository.

The Just-in-time aspect of creation and an org completely built from your source code repository, makes it an ideal candidate to validate changes before merging pull requests. In this process, a freshly spun up scratch org could be used to deploy the metadata in your repository with the changes \( a PR process creates a temporary merge of the incoming branch along with current head of the target branch\), run apex tests, run UI tests etc. This addresses the following problems compared to using a sandbox for validation, especially in large programs.

* **Time consumed to spin a sandbox:** Developer sandbox still takes anywhere under 1 hour to create and activate a new environment. So it is not cost effective to provision sandboxes as a just-in-time disposable environment.   
* **CI Org getting corrupted:**  Due to the time taken to spin a sandbox for every run,  often a dedicated CI sandbox or an existing sandbox is re-purposed for validating incoming pull requests.  Due to the nature in software development for Salesforce, these sandbox typically tend to become corrupted due to unwanted deployments or configuration changes directly in the org.  As a result the changes must be manually fixed before being able to be use again as the CI org.   
* **Resource Contention:** Before scratch org's came into existence, typically a sandbox was used for validation run's. This means validation run's had to be queued up waiting for the CI environment to be free.  As a result, deployment queues on the sandbox may result in delays in validation error results.

## Building a pool of scratch org's

As you try to automate more of your business processes in Salesforce, you cannot avoid adding third party managed packages as a dependency to your configuration metadata and code in your repository. The time required to spin up a just-in-time scratch org would increase and the value of having quick feedback diminishes. This is the primary reason why scratch org pools pre-installed with managed packages and your custom configuration and code from your repository will enable you to immediately validate the PR check process without waiting for a single, new scratch org to be provisioned. If required, sample test data can be loaded to your scratch orgs was well to allow developers to effectively complete their user stories.

{% hint style="info" %}
The Prepare command was built primarily due to the delays from Salesforce to enable **snapshot** feature and make it GA to the public. However, even with snapshot feature, you might need to rebuild the snapshot every day, as we have noticed in a large mono repo scenario \(full deployment of metadata also takes long time\). We will modify the command as needed when this feature launches to utilize snapshot accordingly.
{% endhint %}

We expect you to build a pool of scratch org's using a pipeline at scheduled intervals, that ensures the pools are always replenished with scratch org's ready for consumption whenever you demand it.

{% hint style="info" %}
Please note before creating a pool you need to install the prerequisite fields to the DevHub Org which help the validate/fetch commands to fetch a scratch org from the pool. Instructions on how to install the prerequisite materials are available [here](https://github.com/Accenture/sfpowerkit/wiki/Getting-started-with-ScratchOrg-Pooling).
{% endhint %}

## Steps undertaken by prepare command

The prepare command does the following sequence of activities

1. **Calculate the number of scratch orgs to be allocated** \(Based on your requested number of scratch orgs and your org limits, we calculate what is the number of scratch orgs to be allocated at this point in time\)
2. **Fetch the artifacts from using "artifactFetchScript" if provided / Build all artifacts**
3. **Create the scratch orgs, and update Allocation\_status\_c of each these orgs to "In Progress"**
4. **On each scratch org, in parallel, do the following activities**
   * Install SFPOWERSCRIPTS\_ARTIFACT\_PACKAGE \(04t1P000000ka9mQAA\) for keeping track of all the packages which will be installed in the org. You could set an environment variable SFPOWERSCRIPTS\_ARTIFACT\_PACKAGE to override the installation with your own package id \(the source code is available [here](https://github.com/Accenture/sfpowerscripts/tree/develop/prerequisites/sfpowerscripts-artifact)\)
   * Install all the dependencies of your packages, such as managed packages that are marked as dependencies in your sfdx-project.json
   * Install all the artifacts that is either built/fetched
5. **Mark each completed scratch org as "Available"**
6. **Delete all the failed scratch orgs** - check **Why do some scratch org's fail during pool creation?** below

{% hint style="warning" %}
**Also ensure your DevHub is authenticated using** [**JWT based authentication**](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_jwt_flow.htm) **and note that the private key should be stored in secure place \(in a Key Management System or Secure Storage\)**
{% endhint %}

{% hint style="info" %}
Please note prepare command should **ONLY** be used with a DevHub authenticated using **JWT**, so that the connected app could be replicated to the scratch org's created by prepare command. If you are using any other means of authenticating to your DevHub, the scratch org's generated by prepare command will not be available for consumption by **validate** commands
{% endhint %}

## **Using pre-existing artifacts in Scratch Org Pools**

Building packages in the repository during pooling, takes a considerable amount of time, as well as there could be situations where the latest head is broken. Hence we recommend you to last known good version from the artifact repository. A hook is provided to run a script \(that you provided\) that would be used to fetch sfpowerscripts artifact from an artifact repository when used with **--installall** flag. The script will be provided with _**artifactname** \(name of the package\) and **arifact\_directory**_ \( the directory where the artifact should be placed\) parameters. It is the responsibility of the script to provide with the right version of the artifact. We usually recommend using the latest tested and validated version of the artifacts installed as source packages to the scratch org.

{% hint style="info" %}
If **--installall** flag is utilized, sfpowerscripts would attempt to do a build of all packages in the repository and install it to the scratch org.
{% endhint %}

## Installing **pre-existing artifacts** as source packages

If this flag \(**--installassourcepackages**\) is used, we would attempt installing all packages as [source packages](../faq/package-types/source-packages.md), overriding the default package type \(so an [unlocked package ](../faq/package-types/unlocked-packages.md)will be installed as a source package\).

{% hint style="success" %}
We typically recommend this option to install your packages in the repo as source packages, as often we have noticed, during the validation phase, where a package is installed as a source package often causes issues when deployed on top of an unlocked package.
{% endhint %}

## Managing Package Dependencies

prepare command utilizes \(**sfpowerkit:package:dependencies:install**\) under the hood to orchestrate installation of package dependencies. You can mark a dependency of package, as described in Salesforce [docs](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev2gp_config_file.htm)

```javascript
{
  "packageDirectories": [
    {
      "path": "util",
      "default": true,
      "package": "Expense Manager - Util",
      "versionName": "Winter ‘20",
      "versionDescription": "Welcome to Winter 2020 Release of Expense Manager Util Package",
      "versionNumber": "4.7.0.NEXT"
    },
    {
      "path": "exp-core",
      "default": false,
      "package": "Expense Manager",
      "versionName": "v 3.2",
      "versionDescription": "Winter 2020 Release",
      "versionNumber": "3.2.0.NEXT",
      "dependencies": [
        {
          "package": "Expense Manager - Util",
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

Let's unpack the concepts utilizing the above example

* There are two unlocked packages
  * Expense Manager - Util is an unlocked package in your DevHub, identifiable by 0H in the packageAlias
  * Expense Manager - another unlocked package which is dependent on ' Expense Manager - Util', 'TriggerFramework' and  'External Apex Library - 1.0.0.4'
* External Apex Library is an external dependency, It could be a managed package or any unlocked package built on a different devhub. All external package dependencies have to be defined with 04t id. \( You get the 04t id of a managed package from the installation URL from AppExchange or contact your vendor\)
* sfpowerscripts parses sfdx-project.json and does the following in order
  * Skips Expense manager - Util as it doesn't have any dependencies
  * For Expense manager
    * Checks whether any of the package is part of the same repo, in this example 'Expense Manager-Util' is part of the same repository and will not be installed as a dependency
    * Installs the latest version of TriggerFramework \( with major, minor and patch versions matching 1.7.0\) to the scratch org
    * Install the 'External Apex Library - 1.0.0.4' by utilizing the 04t id provided in the packageAliases

If any of the managed package has keys, it can be provided as an argument to the prepare command. Check the command's flag for more information

### Key Support for Managed Packages

The format for the 'keys' parameter is a string of key-value pairs separated by spaces - where the key is the name of the package, the value is the protection key of the package, and the key-value pair itself is delimited by a colon .

e.g. `--keys "packageA:12345 packageB:pw356 packageC:pw777"`

{% hint style="warning" %}
The time taken by this command depends on how many managed packages and your packages that need to be installed. Please note, if you are triggering this command in a CI server, ensure proper time outs are provided for this task, as most cloud based CI providers have time limits on how long a single task could be run to completion.
{% endhint %}

## Handling a change in shape of the scratch org's in pool

If it is a change in settings, check out the [validate command's documentation](validate.md) where you will find an option how to update settings of a scratch org from the pool. Otherwise you will have to delete the existing pool and recreate again.

## Managing the Scratch Org pool

You can use the **sfpowerscripts:pool** topic to manage the scratch org pools created by prepare command.

## Package checkpoints

Package checkpoints allow precise control over which scratch orgs are committed to a pool when there are deployment failures and the `--succeedondeploymenterrors` flag is activated. To designate a package as a checkpoint, add the property `checkpointForPrepare: true` to the package in the sfdx-project.json. Only scratch orgs that satisfy at least one checkpoint will be committed to the pool. This provides more consistency in what you can expect from your scratch orgs.

