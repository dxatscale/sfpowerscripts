# Artifacts

sfpowerscripts operate on the concepts of artifacts. Artifacts are central to the concept of sfpowerscripts and its very existense.  Artifacts are traceable, versioned, immutable entities that get generated during the build or promote command. sfpowerscripts artifacts contain source code of the package, metadata information , changelog and much more.  Artifacts help sfpowerscripts to orchestrate deployment without being tied to the notion of branches.   


### Artifact Registries

Artifact Registries allow one to store all the application artifacts in one central place. It typically provide features to manage various the full lifecycle of artifacts. Here is a short video from Jfrog explaining the need for an artifact registry. **Please note we are platform independent and work with any artifact registry which supports Universal  / NPM Artifacts** 

{% embed url="https://www.youtube.com/watch?v=r2\_A5CPo43U" caption="" %}

### Artifact Registries in the context of sfpowerscripts

Artifact registry allows you to split your CI and CD pipelines. We believe that this is essential for a smoother deployment model and allows you to better control what is being deployed to environments if you are using a multi-stage environment strategy.

Let's have a look at the below example, here a CI pipeline creates a bunch of artifacts/packages, then the publish command is used to publish these artifacts into an Artifact Registry.

![](../.gitbook/assets/image%20%2813%29%20%281%29%20%282%29%20%282%29%20%283%29%20%285%29%20%282%29%20%285%29.png)

An important thing to note here is especially when a CI pipeline is enabled with '**diffcheck'** functionality, it only builds packages for the particular run. Unless you are immediately deploying these packages to production, there is no way to deploy an entire set of packages other than going through each of the build runs and pushing into production. This is where an artifact registry comes into play, it stores all the artifacts produced by the build system into a repository, which allows you to consolidate all versions of your artifacts and then allowing you to decide which all packages/artifacts should be aggregated and released into production.

The CD pipeline \(or called as 'Release' pipelines in some CI/CD systems\) can be triggered manually or automatically, with artifacts and it's version number as the input. Typically we advise you to select all the latest versions in your artifact repository and add an option to override a certain version of the package by fetching a run time input \(Most repositories have some api's which will allow you to list all the packages in a repository and its versions\). 

### **Type of Artifact Registries supported**

Rather than lock everyone into a particular registry provider,  sfpowerscripts supports artifact registries which support the following

* **NPM compatible private registry** \(Almost  every artifact registries supports NPM \)
* **A  registry which supports universal packages \(** Jfrog Aritfactory, Azure Artifacts\)

{% hint style="danger" %}
Please ensure you are not publishing sfpowerscripts artifacts to npm.js, \( the default  public npm registry\). It is against the terms of service for npm.js, as it only allows Javascript packages. 
{% endhint %}

### Setting up an Artifact Registry

Please refer to your artifact registry provider's documentation on how to set it up. If you are planning to use npm compatible private registry, here are some links to get you started  


* Github [https://docs.github.com/en/packages/guides/configuring-npm-for-use-with-github-packages](https://docs.github.com/en/packages/guides/configuring-npm-for-use-with-github-packages)
* Gitlab [https://docs.gitlab.com/ee/user/packages/npm\_registry/](https://docs.gitlab.com/ee/user/packages/npm_registry/)
* Azure Artifacts [https://docs.gitlab.com/ee/user/packages/npm\_registry/](https://docs.gitlab.com/ee/user/packages/npm_registry/)
* JFrog Artifactory [https://www.jfrog.com/confluence/display/JFROG/npm+Registry](https://www.jfrog.com/confluence/display/JFROG/npm+Registry)
* MyGet [https://docs.myget.org/docs/reference/myget-npm-support](https://docs.myget.org/docs/reference/myget-npm-support)

You can read additional information on [Publish](orchestrator/publish.md#i-am-planning-to-use-non-npm-compabible-sfpowerscripts-artifact-how-do-i-create-the-script-that-uploads-artifacts-to-my-registry) command, which is the equivalent sfpowerscripts functionality responsible for publishing packages to the repository

### Publishing/Fetching Packages  to or from Artifact Registry

sfpowerscripts provides with functionality to help you fetch or [publish](orchestrator/publish.md) artifacts.  Some orchestrator commands like prepare also fetches artifacts from the artifact registry.  



