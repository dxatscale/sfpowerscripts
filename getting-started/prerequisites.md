# Prerequisites

The following pre-requisites are required for sfpowerscripts to work

### **Understanding of Salesforce DX and Packaging in general**

To get the maximum benefit out of sfpowerscripts, you need a good understanding of GIT, Salesforce DX and packaging in general. Here are some links to get you started  
  
1. [Trailhead Modules](https://trailhead.salesforce.com/en/users/azlam/trailmixes/salesforce-dx)  
2. [Adopting Package Based Development Model in Salesforce  
](https://www.linkedin.com/pulse/adopting-package-based-development-model-salesforce-azlam-abdulsalam/?trk=read_related_article-card_title)

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

 [sfdx-cli ](https://www.npmjs.com/package/sfdx-cli):  sfpowerscripts is a SFDX CLI extension. Hence require the latest version of sfdx-cli installed in your CI/CD agents

```text
$ npm i sfdx-cli
```

- [sfpowerkit ](https://github.com/accenture/sfpowerkit):  sfdx plugin that has variety of helper commands, sfpowerscripts uses sfpowerkit for various functionality such as reconciling profiles. 

```text
$ echo'y' | sfdx plugins:install sfpowerkit
```

  
 - [sfdmu ](https://github.com/forcedotcom/SFDX-Data-Move-Utility): sfdx plugin that helps in data migration between orgs or between source to orgs. sfpowerscripts utilizes sfdmu for data package

```text
$ echo'y' | sfdx plugins:install sfdmu
```

 - [sfpowerscripts](https://www.npmjs.com/package/@dxatscale/sfpowerscripts):  Install the sfpowerscripts sfdx-cli plugin from npm

```text
$ echo'y' | sfdx plugins:install @dxatscale/sfpowerscripts
```

Alternatively, you could use our [docker](docker.md) image and we highly recommend to utilize it.

### **StatsD Server \(optional\)**

Metrics should be a key part of your DevOps process. It is through these metrics, one can drive continuous improvement of your delivery process. Almost all commands in sfpowerscripts, is instrumented with StatsD.

You will need a StatsD server reachable from your CI/CD agent to report the metrics. Read more on supported metrics and dashboards [here](../faq/metrics-and-dashboards.md).

### **Artifact Repository \(optional\)**

sfpowerscripts is designed to work with [asynchronous pipelines](https://dxatscale.gitbook.io/sfpowerscripts/faq/orchestrator#is-there-a-pipeline-schematic-diagram-that-i-can-understand), where CI and CD is separated into two distinct pipelines. This means an artifact repository such as Azure Artifacts, Jfrog Artifactory is essential to store the built artifacts.

A linear pipeline can also be used on smaller projects where a CI/CD pipeline is a single synchronous pipeline. In this case you do not need an artifact repository  
  
 

