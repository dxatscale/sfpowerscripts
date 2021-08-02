---
description: Run checks before accepting incoming changes
---

# Validate

**validate** command helps you to validate a change made to your configuration / code. This command is triggered as part of your pull request process, to ensure the correctness of configuration/code, before being merged into your **main** branch. validate simplifies setting up and speeding up the process by using a scratch org prepared earlier using [prepare ](prepare/)command.

**validate** command at the moment runs the following checks

* Checks accuracy of metadata by deploying the metadata to a Just-in-time CI org
* Triggers Apex Tests
* Validate Apex Test coverage of each package

## Sequence of Activities

The following are the list of steps that are orchestrated by the **validate** command

1. Fetch a scratch org from the provided pools in a sequential manner
2. Authenticate to the Scratch org using the auth url fetched from the Scratch Org Info Object
3. Build packages that are changed by comparing the tags in your repo against the packages installed in scratch org
4. For each of the packages \(internally calls the Deploy Command\)
   * Deploy all the built packages as [source packages](../faq/package-types/source-packages.md) / [data package](validate.md)  \(unlocked packages are installed as source package\)
   * Trigger Apex Tests if there are any apex test in the package
   * Validate test coverage of the package depending on the type of the package \( source packages: each class needs to have 75% or more, unlocked packages: packages as whole need to have 75% or more\)

## Shapefile of a scratch org

The shape file is a zip containing scratch org definition in MDAPI format. It can be deployed to a scratch org to configure its available features and settings.

Providing a shape file allows ad-hoc changes to the scratch org definition of pre-existing scratch org pools, without having to re-create the pool from scratch.

The scratch org shape file is a zip that gets created when you perform a `$ sfdx force:org:create` . To retrieve the file, go to your system's TEMP directory and copy the `shape.zip` file.

**MacOs**

1. Open up the terminal

```text
$ cd $TMPDIR
$ cp shape.zip [dest]
```

**Windows**

Start &gt; Run &gt; %TEMP%

## Validate against an existing org

While validate command works against a scratch org fetched from the Scratch Org pool \(created by prepare command\), there might be instances where you need to validate against an Org where you have more data or control over \(as in to write more scripts\). This is where a variant of the command **validateAgainstOrg** come into play. You could provide a target org and sfpowerscripts will try to validate the incoming changes against that org. To make a diff based validation work, please ensure the org has '[sfpowerscripts\_artifact](https://dxatscale.gitbook.io/sfpowerscripts/cli/prerequisites#on-each-org-sandbox-production-that-you-intend-to-deploy)' installed and the records populated with packages that it already has.

## Common Queries

### My metadata looks intact, but validate is failing on deployment of some packages? Why is that and what should be done?

We have noticed specific instances where a change is not compatible with a scratch org fetched with the pool. Most notorious are changes to picklists, causing checks to fail. We recommend you always create a pool, with out **installall** flag, and design your pipelines in a way \(through an environment variable / or through a commit message hook\) to switch to a pool which only has the dependent packages for your repo to validate your changes.

### I have some issues with some apex test on a particular package and I need to disable it temporarily. What are my options?

You can disable the testing on a particular package by adding the following descriptor to the packages that need to be skipped testing

```text
"skipTesting":<boolean> //default:false, skip apex testing during installation of source package to a sandbox
```

### I am not able to get the coverage quite right for a source package and validation is failing. What are my options?

Source packages have a more stringent validation \(for an optimized deployment, as each class in the package need to have 75% or more\). There will be situations when you need to just go on temporarily \(though we don't recommend it\), you could use the below descriptor on the package

```text
  "skipCoverageValidation":<boolean> //default:false, skip apex coverage validation during validation phase,
```

### I am getting "bad object:xxxyyy" error during validate command, What am I doing wrong?

Validate commands compare the incoming commit, with what is installed in the scratch org, and what is in the repos to figure out which packages are to be built and validated in the scratch org. CI Build systems especially like **Github Actions** by default only do a fetch of the tip of the Pull Request branch, and hence validate command will not be able to reach out the ancestors to do a diff. We recommend you to check the CI/CD platform docs to do a more deeper fetch of the repo. Here is how is it in Github

```text
            # Checkout the code in the pull request
            - name: 'Checkout source code'
              uses: actions/checkout@v2
              with:
                fetch-depth: 0
```

