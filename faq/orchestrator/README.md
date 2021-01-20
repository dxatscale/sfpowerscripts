---
description: 'Ask us anything about orchestrator, the shiny new kid on the block'
---

# Orchestrator

## What is this orchestrator?

**sfpowerscripts:orchestrator** is a group of commands \(or topic in the CLI parlance\) that enables one to work with multiple packages in a mono-repo through the development lifecycle or stages. The current version of the orchestrator features these commands

![Snapshot for orchestrator](../../.gitbook/assets/image%20%287%29%20%281%29%20%281%29.png)

## When should I use orchestrator?

You should use the orchestrator when you have two or more packages \( source/unlocked/data\) and mono-repo is your preferred approach.

## Hmm, these orchestrator contains  pretty powerful one line commands, will I lose my flexibility in my pipeline?

No, orchestrator is built around our experience when dealing with a very large org with multiple packages. We have added lot of "**modifiers**" that can be added as to each individual package which can be used to control the test/build/deploy behavior of a package declaratively. If these options are not sufficient, we are happy to help by adding additional options or you could script yourselves using the standalone sfpowerscripts commands. The current **"modifiers"** for orchestrator as follows, however each individual packages supports more modifiers, which is detailed **here.**

```text
  {

    "skipDeployOnOrgs": ["org1","org2"], // List of org's that this package should be skipped during deployment
    "skipCoverageValidation":<boolean> //default:false, skip apex coverage validation during validation phase,
    "ignoreOnStage": [ //Skip this package during the below orchestrator commands
         "prepare",
          "validate"
        ] 
  }
```

## Is the above mentioned,  is all the "modifiers" that is available?

No, the above are the modifiers for the orchestrator commands, irrespective if you use orchestrator or individual commands, following modifiers are available for every packages 

```text
  {
    "aliasfy": <boolean>, // Only for source packages, allows to deploy a subfolder whose name matches the alias of the org when using deploy command
    "isOptimizedDeployment": <boolean>  // default:true for source packages, Utilizes the apex classes in the package for deployment,
    "skipTesting":<boolean> //default:false, skip apex testing during installation of source package to a sandbox
    "skipCoverageValidation":<boolean> //default:false, skip apex coverage validation during validation phase,
    "destructiveChangePath:<path> // only for source, if enabled, this will be applied before the package is deployed
    "assignPermSetsPreDeployment: ["","",]
    "assignPermSetsPostDeployment: ["","",]
    "preDeploymentScript":<path> //All Packages
    "postDeploymentScript:<path> // All packages
    "reconcileProfiles:<boolean> //default:true Source Packages 
  }
```

## Is all modifiers applicable for every stages of the orchestrator?

<table>
  <thead>
    <tr>
      <th style="text-align:left">Modifier</th>
      <th style="text-align:left">Description</th>
      <th style="text-align:left">Stages Applied</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="text-align:left">aliasfy</td>
      <td style="text-align:left">Deploy a subfolder in a source package that matches the alias of the org</td>
      <td
      style="text-align:left">deploy</td>
    </tr>
    <tr>
      <td style="text-align:left">isOptimizedDeployment</td>
      <td style="text-align:left">Detects test classes in a source package automatically and utilize it
        to deploy the provided package</td>
      <td style="text-align:left">deploy, validate</td>
    </tr>
    <tr>
      <td style="text-align:left">skipTesting</td>
      <td style="text-align:left">Skip testing during deployment</td>
      <td style="text-align:left">
        <p>deploy,</p>
        <p>validate</p>
      </td>
    </tr>
    <tr>
      <td style="text-align:left">skipCoverageValidation</td>
      <td style="text-align:left">Skip the coverage validation of a package (unlocked/source)</td>
      <td style="text-align:left">validate</td>
    </tr>
    <tr>
      <td style="text-align:left">destructiveChangePath</td>
      <td style="text-align:left">Apply destructive changes during deployment</td>
      <td style="text-align:left">deploy</td>
    </tr>
    <tr>
      <td style="text-align:left">assignPermsetsPreDeployment</td>
      <td style="text-align:left">Apply permsets before deploying a package</td>
      <td style="text-align:left">
        <p>prepare,</p>
        <p>validate,</p>
        <p>deploy</p>
      </td>
    </tr>
    <tr>
      <td style="text-align:left">assignPermsetsPostDeployment</td>
      <td style="text-align:left">Apply permsets after deploying a package</td>
      <td style="text-align:left">
        <p>prepare,</p>
        <p>validate,</p>
        <p>deploy</p>
      </td>
    </tr>
    <tr>
      <td style="text-align:left">reconcileProfiles</td>
      <td style="text-align:left">Reconcile Profiles during a deployment of source packages</td>
      <td style="text-align:left">
        <p>prepare,</p>
        <p>validate,</p>
        <p>deploy</p>
      </td>
    </tr>
  </tbody>
</table>

## Is there an option to change forceIgnore files depending upon the stage?

Sometimes, due to certain platform errors, some metadata components need to be ignored during **quickbuild** or **validate**  or any other stages. sfpowerscripts offer you an easy mechanism, which allows to switch .forceignore files depending on the stage. 

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

## Can I combine orchestrator with standalone install commands.. such as build from orchestrator and script out install package commands?

Excluding **prepare** and **validate**, the other orchestrator commands such as **quickbuild, build** and **deploy** operate on a given artifact directory \(that contains sfpowerscripts artifacts\) and a sfdx-project.json

## Is there a lifecycle diagram that I can follow to understand how to model the process using the orchestrator?

Here is a sample model that you could use on simple programs

![](../../.gitbook/assets/image%20%287%29.png)

## Is there an example repo, where all these commands are being used?

Yes, head to the repo [https://github.com/dxatscale/easy-spaces-lwc](https://github.com/dxatscale/easy-spaces-lwc/tree/develop/.github) for examples on how to use these commands with GitHub actions

## Can I ignore any package during any stage/lifecycle/command? For eg: I do not want this package to be processed by the prepare command

Yes, you could use the `ignoreOnStage` descriptor to mark which packages should be skipped by the lifecycle commands.

## Can **deploy** command in the orchestrator, deploy artifacts without the sfdx-project.json?

Not yet we are working on it, currently deploy commands can be used only when sfdx-project.json is available, as it determines the order of the packages to be installed, so it could only be used in a linear pipeline such as build -&gt; deploy\(sit\) -&gt; deploy\(uat\) -&gt; deploy\(prod\). If a different strategy is used, where multiple commits are accumulated to form builds and builds aggregated before deploying. In this case, we recommend to use the orchestrator till your daily/immediate testing environment, once from there the artifacts are published into a artifact repository, a script based model \(using the non orchestrator commands\) could be applied for deploying into higher environments.



