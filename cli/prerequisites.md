# Prerequisites

The following pre-requisites are required for sfpowerscripts to work

### **On your DevHub / Production Org**

[Addtional fields for pooling: ](https://github.com/Accenture/sfpowerscripts/tree/develop/prerequisites/scratchorgpool) prepare functionality in the orchestrator  needs additional fields to be deployed on DevHub. These fields store information regarding scratch org's. 

```text
git clone https://github.com/Accenture/sfpowerscripts
cd sfpowerscripts
cd prerequisites/scratchorgpool
sfdx force:source:deploy -p force-app -u Devhub -w 30 -l RunSpecifiedTests -r skip
```

### **On each org \(sandbox/production\) that you intend to deploy**

[sfpowerscripts-artifact](https://github.com/Accenture/sfpowerscripts/tree/develop/prerequisites/sfpowerscripts-artifact) : Utilized for maintaining a record of packages installed in an org. Used by prepare, validate and deploy commands. You can either use an unlocked package built from our org or build one and deploy one yourself.

You need to install the package to every target org \(including your production environment\). The command for installing this package is as follows

```text
sfdx force:package:install --package 04t1P000000ka0fQAA -u <org> -w 10
```

 If your prefer to install a package from your own DevHub rather than this package, you could do by building a package from the source provided at the [URL](https://github.com/Accenture/sfpowerscripts/tree/develop/prerequisites/sfpowerscripts-artifact). Once this package is built,  you can  override sfpowerscripts to use this package by passing in the  the environment variable SFPOWERSCRIPTS\_ARTIFACT\_UNLOCKED\_PACKAGE

### **On your CI/CD**

- [sfpowerkit ](https://github.com/accenture/sfpowerkit):  sfdx plugin that has variety of helper commands, sfpowerscripts uses sfpowerkit for various functionality such as reconciling profiles. 

```text
$ echo'y' | sfdx plugins:install sfpowerkit
```

  
 - [sfdmu ](https://github.com/forcedotcom/SFDX-Data-Move-Utility): sfdx plugin that helps in data migration between orgs or between source to orgs. sfpowerscripts utilizes sfdmu for data package

```text
$ echo'y' | sfdx plugins:install sfdmu
```

### **Artifact Repository \(optional\)**

sfpowerscripts is designed to work with [asynchronous pipelines](https://dxatscale.gitbook.io/sfpowerscripts/faq/orchestrator#is-there-a-pipeline-schematic-diagram-that-i-can-understand), where CI and CD is separated into two distinct pipelines. This means an artifact repository such as Azure Artifacts, Jfrog Artifactory is essential to store the built artifacts.

A linear pipeline can also be used on smaller projects where a CI/CD pipeline is a single synchronous pipeline. In this case you do not need an artifact repository  
  
 

