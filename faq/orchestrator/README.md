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



