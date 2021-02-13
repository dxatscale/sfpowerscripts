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
        ],
    "alwaysDeploy": <boolean> // If true, deploys package even if already installed in org
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
      <td style="text-align:left"><b>aliasfy</b>
      </td>
      <td style="text-align:left">Deploy a subfolder in a source package that matches the alias of the org</td>
      <td
      style="text-align:left"><b>deploy</b>
        </td>
    </tr>
    <tr>
      <td style="text-align:left"><b>isOptimizedDeployment</b>
      </td>
      <td style="text-align:left">Detects test classes in a source package automatically and utilize it
        to deploy the provided package</td>
      <td style="text-align:left"><b>deploy, validate</b>
      </td>
    </tr>
    <tr>
      <td style="text-align:left"><b>skipTesting</b>
      </td>
      <td style="text-align:left">Skip testing during deployment</td>
      <td style="text-align:left">
        <p><b>deploy,</b>
        </p>
        <p><b>validate</b>
        </p>
      </td>
    </tr>
    <tr>
      <td style="text-align:left"><b>skipCoverageValidation</b>
      </td>
      <td style="text-align:left">Skip the coverage validation of a package (unlocked/source)</td>
      <td style="text-align:left"><b>validate</b>
      </td>
    </tr>
    <tr>
      <td style="text-align:left"><b>destructiveChangePath</b>
      </td>
      <td style="text-align:left">Apply destructive changes during deployment</td>
      <td style="text-align:left"><b>deploy</b>
      </td>
    </tr>
    <tr>
      <td style="text-align:left"><b>assignPermsetsPreDeployment</b>
      </td>
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
      <td style="text-align:left"><b>reconcileProfiles</b>
      </td>
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
      <td style="text-align:left"><b>preDeploymentScript</b>
      </td>
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
      <td style="text-align:left"><b>postDeploymentScript</b>
      </td>
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
      <td style="text-align:left"><b>alwaysDeploy</b>
      </td>
      <td style="text-align:left">Deploys package, even if its installed already in the org. The artifact
        has to be present in the artifact directory for this particular option
        to work</td>
      <td style="text-align:left"><b>deploy</b>
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

## Is there a pipeline schematic diagram that I can understand?

The following schematic explains the Continuous Integration and Continuous deployment aspect of the pipelines and sfpowerscripts commands utilized. For brevity, prepare and validate is being excluded

![](../../.gitbook/assets/image%20%2813%29%20%281%29.png)

## Is there an example repo, where all these commands are being used?

Yes, head to the repo [https://github.com/dxatscale/easy-spaces-lwc](https://github.com/dxatscale/easy-spaces-lwc/tree/develop/.github) for examples on how to use these commands with GitHub actions. The .azue-pipelines folder contains sample pipelines to experienment.  

## Can I ignore any package during any stage/lifecycle/command? For eg: I do not want this package to be processed by the prepare command

Yes, you could use the `ignoreOnStage` descriptor to mark which packages should be skipped by the lifecycle commands.

## Can **deploy** command in the orchestrator, deploy artifacts without the sfdx-project.json?

Yes, deploy commands will be able to operate on artifacts \(from Release 19\) by deciphering the sequence of deployment from the latest package provided in the collection of artifacts.

##  





