---
description: The heart of sfpowerscripts
---

# Orchestrator

## Orchestrator

**sfpowerscripts:orchestrator** is a group of commands \(or topic in the CLI parlance\) that enables one to work with multiple packages in a mono-repo through the development lifecycle or stages. The current version of the orchestrator features these commands

{% embed url="https://youtu.be/-3\_DHysV7os" caption="" %}

### A typical pipeline

To understand the orchestrator, let's look at a typical CI/CD pipeline for a package-based development in a program that has multiple environments. For brevity, prepare and validate states are not discussed.

![Flow Diagram](../.gitbook/assets/flowdiagram_revised.png)



Let's dive into the pipeline depicted above, there key stages we wil be 

* **CI Pipeline**: A pipeline that gets triggered on every merge to the trunk. During this process, the following stages happen in sequence.

  * [quickbuild](../commands/build-and-quickbuild.md) a set of changed packages \(packages without validating for dependency or code coverage\) 
  * [deploy](../commands/deploy.md) to a Development Sandbox.  This process ensures the upgrade process of a package is accurate and you could also do a quick round of validation of your packages coming in from a scratch org.
  * Once deploy is successful, the pipeline proceed to [build](../commands/build-and-quickbuild.md) the set of changed packages \(but this time with dependency validation and code coverage check\). The same job could then [publish](../commands/publish.md) these validated packages to an artifact repository for deployment into higher environments for further testing.

* **CD Pipeline**:  A Continuous Delivery Pipeline that gets triggered manually or automatically \(every day on a scheduled time interval\) deploying a set of the latest validated packages to a series of environment. The sequence of stages include
  * Fetch the Artifacts from the artifact repository using the provided release definition
  * Deploy the set of packages say to System Testing environment
  * Upon successful testing, the same set of packages progress to the System Integration Test environment and so forth
  * If the packages are successful in all of the testing, the packages are marked for promotion
  * The promoted packages are then deployed to production.

Take a note of each stage in the pipeline above and the key functionality required, such as build, deploy, release etc, this is typically done by inserting the equivalent sfdx commands into your CI/CD pipeline definition. As your number of packages grow, it not only is hard to maintain but is error prone. This is where sfpowerscripts orchestrator simplifies the pipeline to a one time setup. All the stages are driven by sfdx-project.json, which ensures zero maintenance to the pipelines. Each stage of the above pipeline could be modelled by using equivalent sfpowerscripts orchestrator commands

### Orchestrator commands

1. [**prepare**](https://dxatscale.gitbook.io/sfpowerscripts/faq/orchestrator/prepare) **\(sfdx sfpowerscripts:orchestrator:prepare\)**:  Prepare command helps you to build a pool of prebuilt scratch orgs which include managed packages as well as packages in your repository. This process allows you to considerably cut down time in re-creating a scratch org during a pull request validation process when a scratch org is used as Just-in-time CI environment. In simple terms, it reduces time taken in building a scratch org to validate your changes in an incoming pull request. This command also have an option to pull artifacts from your artifact repository, so that say you can prebuild your validation orgs, say from validated set of packages.   
2. [**validate**](../commands/validate.md) **\(sfdx sfpowerscripts:orchestrator:validate\)**: This command goes in pair with the prepare command. It fetches a scratch org from the pool already pre prepared \(by the prepare command\) and deploys/unit tests the changed packages.    
3. [**build**](../commands/build-and-quickbuild.md) **\(sfdx sfpowerscripts:orchestrator:build/quickbuild\)** : This command builds all the packages in parallel wherever possible by understanding your manifest and dependency tree. Goodbye to the sequential builds, where you fail in the n-1th package and have to wait for the next hour. This command brings massive savings to your build \(package creation\) time. Also use the [**quickbuild**](../commands/build-and-quickbuild.md) variant, which builds unlocked package without dependency check in intermittent stages for faster feedback.   
4. [**deploy**](../commands/deploy.md) **\(sfdx sfpowerscripts:orchestrator:deploy\)**: So you have built all the packages, now this command takes care of deploying it, by reading the order of installation as you have specified in your sfdx-project.json. Installs it one by one, deciding to trigger tests etc. and provide you with the logs if anything fails   
5. [**promote**](orchestrator.md) **\(sfdx sfpowerscripts:orchestrator:promote\)** : Promote enables the packages to be deployable to production. This explicit stage prevents incorrectly tested packages to reach production    
6. [**publish**](../commands/publish.md) **\(sfdx sfpowerscripts:orchestrator:publish\)** :  Publish lets you publish the built artifacts into an artifact registry during publish stages of your pipeline.
7. [**release**](../commands/release.md) \(**sfdx sfpowerscripts:orchestrator:release**\) : Release commands orchestrate fetching of artifacts from an artifact repository, deploying to an environment including any external dependencies and generating changelog all driven by a release definition file.

### Controlling Aspects of the Orchestrator

Orchestrator utilizes additional properties mentioned along with each package in your sfdx-project.json which can be used to control what the orchestrator should work with each package.

{% embed url="https://youtu.be/c\_E8fBIlFPo" caption="" %}

<table>
  <thead>
    <tr>
      <th style="text-align:left">Modifier</th>
      <th style="text-align:left">Type</th>
      <th style="text-align:left">Description</th>
      <th style="text-align:left">Stages Applied</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="text-align:left"><b>aliasfy</b>
      </td>
      <td style="text-align:left">boolean</td>
      <td style="text-align:left">Deploy a subfolder in a source package that matches the alias of the org</td>
      <td
      style="text-align:left"><b>deploy</b>
        </td>
    </tr>
    <tr>
      <td style="text-align:left"><b>alwaysDeploy</b>
      </td>
      <td style="text-align:left">boolean</td>
      <td style="text-align:left">Deploys package, even if it&apos;s installed already in the org. The artifact
        has to be present in the artifact directory for this particular option
        to work</td>
      <td style="text-align:left"><b>deploy</b>
      </td>
    </tr>
    <tr>
      <td style="text-align:left"><b>assignPermsetsPreDeployment</b>
      </td>
      <td style="text-align:left">array</td>
      <td style="text-align:left">Apply permsets before deploying a package</td>
      <td style="text-align:left">
        <p><b>prepare,</b>
        </p>
        <p><b>validate,</b>
        </p>
        <p><b>deploy</b>
        </p>
      </td>
    </tr>
    <tr>
      <td style="text-align:left"><b>assignPermsetsPostDeployment</b>
      </td>
      <td style="text-align:left">array</td>
      <td style="text-align:left">Apply permsets after deploying a package</td>
      <td style="text-align:left">
        <p><b>prepare,</b>
        </p>
        <p><b>validate,</b>
        </p>
        <p><b>deploy</b>
        </p>
      </td>
    </tr>
    <tr>
      <td style="text-align:left"><b>buildCollection</b>
      </td>
      <td style="text-align:left">array</td>
      <td style="text-align:left">Utilize this to build packages in unison, it will build all packages in
        the collection, even if only one of them changes</td>
      <td style="text-align:left"><b>build</b>
      </td>
    </tr>
    <tr>
      <td style="text-align:left"><b>destructiveChangePath</b>
      </td>
      <td style="text-align:left">string</td>
      <td style="text-align:left">Apply destructive changes during deployment</td>
      <td style="text-align:left"><b>deploy</b>
      </td>
    </tr>
    <tr>
      <td style="text-align:left"><b>isOptimizedDeployment</b>
      </td>
      <td style="text-align:left">true</td>
      <td style="text-align:left">Detects test classes in a source package automatically and utilize it
        to deploy the provided package</td>
      <td style="text-align:left"><b>deploy, validate</b>
      </td>
    </tr>
    <tr>
      <td style="text-align:left"><b>ignoreOnStage</b>
      </td>
      <td style="text-align:left">array</td>
      <td style="text-align:left">Ignore this package on a particular stage</td>
      <td style="text-align:left">
        <p><b>prepare,</b>
        </p>
        <p><b>build,</b>
        </p>
        <p><b>validate,</b>
        </p>
        <p><b>deploy</b>
        </p>
      </td>
    </tr>
    <tr>
      <td style="text-align:left"><b>postDeploymentScript</b>
      </td>
      <td style="text-align:left">string</td>
      <td style="text-align:left">Run an executable script after deploying a package. User need to provide
        a path to the script file</td>
      <td style="text-align:left">
        <p><b>prepare,</b>
        </p>
        <p><b>validate,</b>
        </p>
        <p><b>deploy</b>
        </p>
      </td>
    </tr>
    <tr>
      <td style="text-align:left"><b>preDeploymentScript</b>
      </td>
      <td style="text-align:left">string</td>
      <td style="text-align:left">Run an executable script before deploying a package. User need to provide
        a path to the script file</td>
      <td style="text-align:left">
        <p><b>prepare,</b>
        </p>
        <p><b>validate,</b>
        </p>
        <p><b>deploy</b>
        </p>
      </td>
    </tr>
    <tr>
      <td style="text-align:left"><b>reconcileProfiles</b>
      </td>
      <td style="text-align:left">boolean</td>
      <td style="text-align:left">Reconcile Profiles during a deployment of source packages</td>
      <td style="text-align:left">
        <p><b>prepare,</b>
        </p>
        <p><b>validate,</b>
        </p>
        <p><b>deploy</b>
        </p>
      </td>
    </tr>
    <tr>
      <td style="text-align:left"><b>type</b>
      </td>
      <td style="text-align:left">string</td>
      <td style="text-align:left">Denotes the type of the package, accepted values are &quot;source&quot;,&quot;data&quot;</td>
      <td
      style="text-align:left">
        <p><b>prepare,</b>
        </p>
        <p><b>validate,</b>
        </p>
        <p><b>deploy</b>
        </p>
        </td>
    </tr>
    <tr>
      <td style="text-align:left"><b>skipCoverageValidation</b>
      </td>
      <td style="text-align:left">boolean</td>
      <td style="text-align:left">Skip the coverage validation of a package (unlocked/source)</td>
      <td style="text-align:left"><b>validate</b>
      </td>
    </tr>
    <tr>
      <td style="text-align:left"><b>skipDeployOnOrgs</b>
      </td>
      <td style="text-align:left">array</td>
      <td style="text-align:left">Skip deployment on a particular org or org(s). Take an array of aliases
        as the input</td>
      <td style="text-align:left">
        <p><b>prepare,</b>
        </p>
        <p><b>validate,</b>
        </p>
        <p><b>deploy</b>
        </p>
      </td>
    </tr>
    <tr>
      <td style="text-align:left"><b>skipTesting</b>
      </td>
      <td style="text-align:left">boolean</td>
      <td style="text-align:left">Skip unit testing during validate or deployment (source packages)</td>
      <td
      style="text-align:left">
        <p><b>deploy,</b>
        </p>
        <p><b>validate</b>
        </p>
        </td>
    </tr>
  </tbody>
</table>

### Handling multiple ignore files

Sometimes, due to certain platform errors, some metadata components need to be ignored during **quickbuild** or **validate** or any other stages. sfpowerscripts offer you an easy mechanism, which allows to switch .forceignore files depending on the stage.

Add this entry to your sfdx-project.json and as in the example below, mention the path to different files that need to be used for different stages

```text
 "plugins": {
        "sfpowerscripts": {
            "ignoreFiles": {
                "prepare": ".forceignore",
                "validate": ".forceignore",
                "quickbuild": "forceignores/.buildignore",
                "build": "forceignores/.validationignore"
            }
        }
```

### Ignoring a package on any particular stage from being being processed by the orchestrator

Utilize the `ignoreOnStage` descriptor to mark which packages should be skipped by the lifecycle commands.

