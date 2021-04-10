# Data Packages

## What is a Data Package?

Data packages are a sfpowerscripts construct that utilise the [SFDMU plugin](https://github.com/forcedotcom/SFDX-Data-Move-Utility) to create a versioned artifact of Salesforce object records in csv format, which can be deployed to the a Salesforce org using the sfpowerscripts package installation command.

The Data Package offers a seamless method of integrating Salesforce data into your CICD pipelines , and is primarily intended for record-based configuration of managed package such as CPQ, Vlocity \(Salesforce Industries\), and nCino.

## Why should I use Data Packages instead of SFDMU directly?

Data packages are a wrapper around SFDMU that provide a few key benefits:

* **Ability to skip the package if already installed:** By keeping a record of the version of the package installed in the target org with the support of an unlocked package, sfpowerscripts can skip installation of data packages if it is already installed in the org
* **Versioned Artifact:**  Aligned with sfpowerscripts principle of traceability, every deployment is traceable to a versioned artifact, which is difficult to achieve when you are using a folder to deploy
* **Orchestration:** Data package creation and installation can be orchestrated by sfpowerscripts, which means less scripting 

## How do I define a Data Package in the sfdx-project.json?

Simply add an entry in the package directories, providing the package's name, path, version number and type \(data\). Your editor may complain that the 'type' property is not allowed, but this can be safely ignored.

```text
  {
    "path": "path--to--data--package",
    "package": "name--of-the-data package", //mandatory, when used with sfpowerscripts
    "versionNumber": "X.Y.Z.0 // 0 will be replaced by the build number passed",
    "type": "data", // required
    "postDeploymentScript":"path--to--script" // script such as populating the record ID to custom setting after data package is loaded 
  }
```

## How do I generate the csv files and export.json for my Data Package?

Export your Salesforce records to csv files using the [SFDMU plugin](https://github.com/forcedotcom/SFDX-Data-Move-Utility). For more information on plugin installation, creating an export.json file, and exporting to csv files, refer to _Plugin Basic &gt; Basic Usage_ in SFDMU's [documentation](https://help.sfdmu.com/quick-start).

![A sample data package structure](../../.gitbook/assets/image%20%285%29.png)

## **What are my options with Data Packages?**

Data packages support the following options, through the sfdx-project.json.

```text
  {
    "path": "path--to--package",
    "package": "name--of-the-package", //mandatory, when used with sfpowerscripts
    "versionNumber": "X.Y.Z.[NEXT/BUILDNUMBER]",
    "type": "data", // required
    "aliasfy": <boolean>, // Only for source packages, allows to deploy a subfolder whose name matches the alias of the org when using deploy command
    "assignPermSetsPreDeployment: ["","",],
    "assignPermSetsPostDeployment: ["","",],
    "preDeploymentScript":<path>, //All Packages
    "postDeploymentScript":<path> // All packages
  }
```

## How to create a pre/post deployment script for data package?

In some situations, you might need to execute a pre/post deployment script to do manipulate the data before or after being deployed to the org. **sfpowerscripts** allow you to provide a path to a shell script \(Mac/Unix\) / batch script \(on Windows\). The script will be provided with the following parameters which could be utilized to write your logic

For eg: if you want to trigger an anonymous apex script after the installation of the package, you will create a script file similar to below and then add the path to the **postDeploymentScript** property of your data package

```text
# $1 package name
# $2 org

sfdx force:apex:execute -f scripts/datascript.apex -u $2
```

## Why isn't force:source:push working with Data packages defined in my sfdx-project.json?

The error arises because the Data Package contains csv files, which are not natively supported by Salesforce. In order to bypass the error, add the package path to the forceignore file. This will not inhibit creation of Data packages.

## Why is the version number for data packages have to end with zero? Doesn't it support .next?

At the moment, it is not supported and we have a bug where the .next is not replaced by passed build number. So ensure that all your source packages in your repository has '0' as the build number.

