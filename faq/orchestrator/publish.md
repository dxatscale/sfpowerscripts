---
description: Bridging your CI and CD pipelines using artifacts
---

# Publish

## What does the Publish command do?

The Publish command pushes artifacts created in the Build stage to an artifact registry primarily for further utilisation by a release pipeline. The user must provide a shell script that handles uploading of artifacts to a package registry of their choice. Typical examples of package registry which supports universal artifacts include Azure Artifacts, JFrog Artifactory.

## What is an Artifact Registry?

Artifact Registries allow one to store all the application artifacts in one central place. It typically provide features to manage various the full lifecycle of artifacts. Here is a short video from Jfrog explaining the need for an artifact registry. **Please note we are platform independent and work with any artifact registry which supports Universal Artifacts**

{% embed url="https://www.youtube.com/watch?v=r2\_A5CPo43U" caption="" %}

## Why do you need an Artifact Registry in the context of sfpowerscripts?

Artifact registry allows you to split your CI and CD pipelines. We believe that this is essential for a smoother deployment model and allows you to better control what is being deployed to environments if you are using a multi-stage environment strategy.    
  
Let's have a look at the below example, here a CI pipeline creates a bunch of artifacts/packages, then the publish command is used to publish these artifacts into an Artifact Registry.  

![](../../.gitbook/assets/image%20%2813%29%20%281%29%20%282%29%20%282%29%20%283%29%20%285%29%20%282%29%20%282%29.png)

An important thing to note here is especially when a CI pipeline is enabled with '**diffcheck'**  functionality, it only builds packages for the particular run. Unless you are immediately deploying these packages to production, there is no way to deploy an entire set of packages other than going through each of the build runs and pushing into production. This is where an artifact registry comes into play, it stores all the artifacts produced by the build system into a  repository, which allows you to consolidate all versions of your artifacts and then allowing you to decide which all packages/artifacts should be aggregated and released into production.

The CD pipeline \(or called as 'Release' pipelines in some CI/CD systems\) can be triggered manually or automatically,  with artifacts and it's version number as the input.  Typically we advise you to select all the latest versions in your artifact repository and add an option to override a certain version of the package by fetching a run time input \(Most repositories have some api's which will allow you to list all the packages in a repository and its versions\). This is an area, which you would need to script it yourself.  We are working on 

## What registry can sfpowerscripts artifacts published to?

Rather than lock everyone into a particular registry provider, you can provide a shell script that handles uploading of artifacts to a registry of your choice.

## How do I create the script that uploads artifacts to my registry?

There are command-line parameters available to your script, which expose the name and version of the package being published, the file path of the artifact and whether the `publishpromoteonly`flag was passed to the command. With the information available through these parameters, push the artifact to the registry using your vendor's API.

Example for Linux / MacOS

```text
# $1 package name
# $2 package version
# $3 artifact file path
# $4 isPublishPromotedOnly

myvendor artifacts push --name $1 --version $2 --path $3
```

## What does the `--publishpromotedonly` flag do?

When the `--publishpromotedonly`flag is specified, only unlocked packages that have been promoted will be published to the registry.

## What does `--gittag` parameter used for?

The `--gittag` parameter creates a tag, at the current commit ID, for packages that have been successfully published. In combination with the `--diffcheck` parameter in the Build commands, the tags enable significant time-saving by comparing the latest tag with the source code - and only building the package if a change is found.

## Why are the git tags not showing up in my repo?

Ensure that the `--pushgittag` parameter is also passed to the Publish command. This parameter assumes that you are already authenticated to the Version Control System.

