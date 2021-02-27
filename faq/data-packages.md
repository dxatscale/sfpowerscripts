# Data Packages

## What is a Data Package? 

Data packages are a sfpowerscripts construct that utilise the [SFDMU plugin](https://github.com/forcedotcom/SFDX-Data-Move-Utility) to create a versioned artifact  of Salesforce object records in csv format, which can be deployed to the a Salesforce org using the sfpowerscripts package installation command.

The Data Package offers a seamless method of integrating Salesforce data into your CICD pipelines , and is primarily intended for record-based configuration of managed package such as CPQ and nCino.

## Why should I use Data Packages instead of SFDMU directly?

Data packages are a wrapper around SFDMU that provide a few key benefits:

* **Ability to skip the package if already installed:** By keeping a record of the version of the package installed in the target org with the support of an unlocked package, sfpowerscripts can skip installation of data packages if it is already installed in the org
*  **Versioned Artifact:**  Aligned with sfpowerscripts principle of traceability, every deployment is traceable to a versioned artifact, which is difficult to achieve when you are using a folder to deploy
* **Orchestration:** Data package creation and installation can be orchestrated by sfpowerscripts, which means less scripting 

## How do I define a Data Package in the sfdx-project.json?

Simply add an entry in the package directories, providing the package's name, path, version number and type \(data\). Your editor may complain that the 'type' property is not allowed, but this can be safely ignored.

```text
  {
    "path": "path--to--package",
    "package": "name--of-the-package", //mandatory, when used with sfpowerscripts
    "versionNumber": "X.Y.Z.[NEXT/BUILDNUMBER]",
    "type": "data", // required
  }
```

## How do I generate the csv files and export.json for my Data Package?

Export your Salesforce records to csv files using the [SFDMU plugin](https://github.com/forcedotcom/SFDX-Data-Move-Utility). For more information on plugin installation, creating an export.json file, and exporting to csv files, refer to _Plugin Basic &gt; Basic Usage_  in their [documentation](https://help.sfdmu.com/quick-start).

## **What are my options with Data Packages?**

Data packages support the following options, through the sfdx-project.json.

```text
  {
    "path": "path--to--package",
    "package": "name--of-the-package", //mandatory, when used with sfpowerscripts
    "versionNumber": "X.Y.Z.[NEXT/BUILDNUMBER]",
    "type": "data", // required
    "aliasfy": <boolean>, // Only for source packages, allows to deploy a subfolder whose name matches the alias of the org when using deploy command
    "assignPermSetsPreDeployment: ["","",]
    "assignPermSetsPostDeployment: ["","",]
    "preDeploymentScript":<path> //All Packages
    "postDeploymentScript:<path> // All packages
  }
```

## Why isn't force:source:push working with Data packages defined in my sfdx-project.json?

The error arises because the Data Package contains csv files, which are not natively supported by Salesforce. In order to bypass the error, add the package path to the forceignore file. This will not inhibit creation of Data packages.

