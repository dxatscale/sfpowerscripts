---
description: >-
  Prepare a pool of scratch org's for validating incoming changes acting as a
  just in time CI server
---

# Prepare

## What does Prepare Command do?

Prepare command helps you to build a pool of prebuilt scratch orgs which include managed packages as well as packages in your repository. This process allows you to considerably cut down time in re-creating a scratch org during validation process when a scratch org is used as Just-in-time CI environment.

Please note that you should still build your own pipeline to provision scratch orgs for your developers to work on stories by using **sfpowerkit pool** related commands. 

## Why do I need to use Scratch Orgs for running tests?

Scratch Org's are one of the best features that Salesforce released, when they re-imagined the Developer Experience with the platform. Scratch Org's are ephemeral org's that can be provisioned as a just-in-time environment, which can be populated with metadata and data from your source control repository.

The Just-in-time aspect of creation and an org completely built from your source code repository, makes it an ideal candidate to validate changes before merging pull requests. In this process, a freshly spun up scratch org could be used to deploy the metadata in your repository with the changes \( a PR process creates a temporary merge of the incoming branch along with current head of the target branch\), run apex tests, run UI tests etc. This addresses the following problems compared to using a sandbox for validation, especially in large programs.

* **Time taken to spin a sandbox:** Developer sandbox still takes anywhere under 1 hour to create and activate a new environment. So it is not cost effective to provision sandboxes as a just-in-time disposable environment.  
* **CI Org getting corrupted:**  Due to the time taken to spin a sandbox for every run,  an dedidicated CI sandbox or an existing sandbox is typical repurposed for validating incoming pull requests.  Due to the nature in software development for Salesforce, these sandbox typically tend to become corrupted due to unwanted deployments or configuration changes directly in the org.  As a result the changes must be manually fixed before being able to be use again as the CI org.  
* **Resource Contention:** Before scratch org's came into existence, typically a sandbox was used for validation run's. This means validation run's had to be queued up waiting for the CI environment to be free.  As a result, deployment queues on the sandbox may result in delays in validation error results.

## I get the benefits of using Scratch Org, Why should I be building a pool of Scratch Orgs?

As you try to automate more of your business processes in Salesforce, you cannot avoid adding third party managed packages on top of configuration metadata and code to your repository. The time required to spin up a just-in-time scratch org would increase and the value of having quick feedback dimnishes. This is the primary reason why scratch org pools pre-installed with managed packages and your custom configuration and code from your repository will enable you to immediately validate the PR check process without waiting for a single, new scratch org to be provisioned.

## How is different from the upcoming snaphsot feature?

The Prepare command was built primarily due to the delays from Salesforce to enable this feature and make it GA to the public. However, even with snapshot feature, you might need to rebuild the snapshot every day, as we have noticed in a large mono repo scenario \(full deployment of metadata also takes long time\). We will modify the command as needed when this feature launches to utilize snapshot accordingly.

## How should I be using this command?

We expect you to build a pool of scratch org's using a scheduled pipeline, that ensures the pools are always replenished with scratch org's ready for consumption. Please note before installing you need to install the prerequisite fields to the DevHub Org which help the validate/fetch commands to fetch a scratch org from the pool. Instructions on how to install the prerequisite materials are available [here](https://github.com/Accenture/sfpowerkit/wiki/Getting-started-with-ScratchOrg-Pooling).

**Also ensure  your DevHub is authenticated using** [**JWT based authentication**](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_jwt_flow.htm) **and note that the private key should  be stored in secure place \(in a Key Management System or Secure Storage\)** 

## Is the pools created in prepare same as **sfpowerkit:pool** commands?

No, the commands are identical and share the same code base, however the sfpowerscripts is an orchestration command, as in it installs dependent packages, as well as code in the repository. sfpowerkit commands are more general purpose and can be termed as 'build your own way'.

## What kind of authentication do I need for prepare command to work?

Please note prepare command should **ONLY** be used with a DevHub authenticated using **JWT**, so that the connected app could be replicated to the scratch org's created by prepare command. If you are using any other means of authenticating to your DevHub, the scratch org's generated by prepare command will not be available for consumption by **validate** commands.

## What is "artifactFetchScript" and how do I go about using it?

Building packages in the repository during pooling, takes a considerable amount of time, as well as there could be situations where the latest head is broken. Hence we recommend you to last known good version from the artifact repository. A hook is provided  to run a script \(that you provided\)  that would be used to fetch sfpowerscripts artifact from an artifact repository when used with **installall** flag. The script will be provided with _**artifactname** \(name of the package\) and **arifact\_directory**_ \( the directory where the artifact should be placed\) parameters . It is the responsibility of the script to provide with the right version of the artifact. We usually recommend using the latest tested and validated version of the artifacts installed as source packages to the scratch org.

## What if I do not provide a script for fetching artifact?

We would attempt to do a build of all packages in the repository and install it to the scratchorg. This is only applicable when using **installAll** flag

## What is meant by **installassourcepackages** ?

If this flag is used, we would attempt installing all packages as source packages, overriding the default package type \(so a unlocked package will be installed as source package\). 

We typically recommend this option to install packages as source packages, as often we have noticed,  during validation phase, where a package is installed as source and this often causes issues when deployed on top of an unlocked package.

## What is the sequence of activities that happen in a prepare command?

1. **Calculate the number of scratch orgs to be allocated** \(  Based on your requested number of scratch orgs and your org limits, we calculate what is the number of scratch orgs to be allocated at this point in time\)
2. **Fetch the artifacts from using "artifactFetchScript" if provided / Build all artifacts**
3. **Create the scratch orgs, and update Allocation\_status\_c of each these orgs to "In Progress"**
4. **On each scratch org, in parallel, do the following activities**
   * Install SFPOWERSCRIPTS\_ARTIFACT\_PACKAGE \( 04t1P000000ka0fQAA\) for keeping track of all the packages which will be installed in the org. You could set an environment variable SFPOWERSCRIPTS\_ARTIFACT\_PACKAGE to override the installation with your own package id \(the source code is available [here](https://github.com/Accenture/sfpowerscripts/tree/develop/prerequisites/sfpowerscripts-artifact)\)
   * Install all the dependencies of your packages, such as managed packages that are marked as dependencies in your sfdx-project.json
   * Install all the artifacts that is either built/fetched
5. **Mark each completed scratch org as "Available"**
6. **Delete all the failed scratch orgs** - check **Why do some scratch org's fail during pool creation?** below

## When I am preparing a pool of scratch org\(s\), what type of packages should I be deploying to it?

We usually recommend you install your latest validated packages \( generated by the **build** command \) deployed as source packages \( we utilize the source carried along with our unlocked package artifact, to convert it as a source package\). This ensures your scratch org is running the latest version of technically validated code.

## How long does this command typically takes? 

The time taken by this command depends on how many managed packages and your packages that need to be installed. Please note, if you are triggering this command in a CI server, ensure proper time outs are provided for this task, as most cloud based CI providers have time limits on how long a single task could be run to completion.

## What happens if my shape of the org changes?

If it is  a change in settings, check out the [validate command's faq](validate.md), where we will explain you how to update settings of a scratch org from the pool. Otherwise you will have to delete the existing pool and recreate again.

## How do I manage these Scratch Org\(s\) created by the pool command, such as deleting a pool?

You can use the **sfpowerscripts:pool** topic to manage the scratch org pools created by prepare command

## Can I use these pools for providing a development environment to developers?

No, these pools are only to be used as a **CI environment**, as the scratch org's fetched from this pool cannot be used by a user other than the user who created. Use **"sfpowerkit"** to create developer pools like example below and use a seperate pipeline to schedule its provision.

```text
sfdx sfpowerkit:pool:create -f config/pool-config-dev.json  -v devhub    
```

Note: sfpowerkit requires you to create your own pool configuration. Follow [here](https://github.com/Accenture/sfpowerkit/wiki/Getting-started-with-ScratchOrg-Pooling) to start.

## I do not want a particular package to be deployed to pooled scratch org's, Is there a way to do it?

Yes, you could use the `ignoreOnStage:[ "prepare" ]` property to mark which packages should be skipped by the prepare command

## I need to run a script during the creation of scratch org, is that possible?

No, sfpowerscripts:prepare doesnt allow you to run any scripts other than what is specified for each package. For eg: each package can have a preDeploymentScript / postDeploymentScript property added to the package. When prepare is installing this particular package, it execute these scripts.

```text
  {
    "path": "path--to--package",
    "package": "name--of-the-package",
    "versionNumber": "X.Y.Z.[NEXT/BUILDNUMBER]",
    "preDeploymentScript":<path> //Path to script file
    "postDeploymentScript:<path> // Path to script file
  }
```

## Why do some scratch org's fail during pool creation?

Occasionally you will find errors like the below one during the pool creation, this is mainly due to the created scratch org, not available for further operations. We have found that to be quite rare. Only that particular scratch org will be skipped and the commands will continue as expected for other scratch org's

```text
Error: getaddrinfo ENOTFOUND page-drive-4000-dev-ed.cs73.my.salesforce.com
    at GetAddrInfoReqWrap.onlookup [as oncomplete] (node:dns:67:26) {
  errno: -3008,
  code: ‘ENOTFOUND’,
  syscall: ‘getaddrinfo’,
  hostname: ‘page-drive-4000-dev-ed.cs73.my.salesforce.com’
}
```

## I have some managed packages that needs keys to be installed on to my scratch orgs, Does sfpowerscripts support it?

The format for the 'keys' parameter is a string of key-value pairs separated by spaces - where the key is the name of the package, the value is the protection key of the package, and the  key-value pair itself is delimited by a colon . 

e.g. `--keys "packageA:12345 packageB:pw356 packageC:pw777"` 

