---
description: Run checks before accepting incoming changes
---

# Validate

## What does validate command do?

**validate** command helps you to validate a change made to your configuration / code. This command should ideally be triggered as part of your pull request process, to ensure that automatically checked code is merged in, before being merged into your **main** branch. validate simplifies setting up and speeding up the process by using a scratch org prepared earlier using [prepare ](prepare.md)command.

Currently validate only works against a  pool of scratch org's prepared by the prepare command.

## What checks do validate run?

**validate** command at the moment runs the following checks

* Checks accuracy of metadata by deploying the metadata to a Just-in-time CI org
* Triggers Apex Tests
* Validate Apex Test coverage of each package

## What is the sequence of activities that happen in validate command?

The following are the list of steps that are orchestrated by the **validate** command

* Authenticate to the DevHub using the provided JWT Key / Client ID
* Fetch a scratch org from the provided pools in a sequential manner
* Authenticate to the Scratch org using the provided JWT Key / Client ID
* Build packages that are changed by comparing the tags in your repo
* For each of the packages \(internally calls the Deploy Command\)
  * Deploy all the built packages as [source packages](../source-packages.md) / [data package](../data-packages.md)  \(unlocked packages are installed as source package\)
  * Trigger Apex Tests if there are any apex test in the package
  * Validate test coverage of the package depending on the type of the package \( source packages: each class needs to have 75% or more, unlocked packages: packages as  whole need to have 75% or more\)

## Why do validate command asks for JWT based authentication?

The command needs JWT based authentication to authenticate to the DevHub and utilize the same credentials to authenticate to the fetched scratch org from the pool.

## What if there are no scratch org's left in the pool?

The **validate** command will fail to execute, as it would not be able to fetch a scratch org from the pool.

## How does validate know which packages to be validated?

It uses the same functionality as in QuickBuild Command  and is explained in [How does Build & QuickBuild  know what to build when using "diffcheck" flag?](build-and-quickbuild.md#how-does-build-and-quickbuild-know-what-to-build-when-using-diffcheck-flag)

## What is a shape file and why should I provide one?

The shape file is a zip containing scratch org definition in MDAPI format. It can be deployed to a scratch org to configure its available features and settings.

Providing a shape file allows ad-hoc changes to the scratch org definition of pre-existing scratch org pools, without having to re-create the pool from scratch.

## How do I get hold of the shape file?

The scratch org shape file is a zip that gets created when you perform a `$ sfdx force:org:create` . To retrieve the file, go to your system's TEMP directory and copy the `shape.zip` file.

**MacOS**

1. Open up the terminal

```text
$ cd $TMPDIR
$ cp shape.zip [dest]
```

**Windows**

Start &gt; Run &gt; %TEMP%

## My metadata looks intact, but validate is failing on deployment of some packages? Why is that and what should be done?

We have noticed specific instances where a change is not compatible with a scratch org fetched with the pool. Most notorious are changes to picklists, causing checks to fail. We recommend you always create a pool, with out **installall** flag, and design your pipelines in a way \(through an environment variable / or through a commit message hook\) to switch to a pool which only has the dependent packages for your repo to validate your changes. 







