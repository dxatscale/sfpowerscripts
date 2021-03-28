---
description: Bridging your CI and CD pipelines using artifacts
---

# Publish

The Publish command pushes artifacts created in the Build stage to an artifact registry primarily for further utilisation by a release pipeline. The user must provide a shell script that handles uploading of artifacts to a package registry of their choice. Typical examples of package registry which supports universal artifacts include Azure Artifacts, JFrog Artifactory.

Rather than lock everyone into a particular registry provider, sfpowerscripts supports artifact registries which support the following

* **NPM compatible private registry** \(Almost  every artifact registries supports NPM \) \* **\(Milestone 21\)**
* **A  registry which supports universal packages \(** Jfrog Aritfactory, Azure Artifacts\)

{% hint style="danger" %}
Please ensure you are not publishing sfpowerscripts artifacts to npm.js, \( the default public npm registry\). It is against the terms of service for npm.js, as it only allows Javascript packages only.
{% endhint %}

## Tagging artifacts to git during publish

The `--gittag` parameter creates a tag, at the current commit ID, for packages that have been successfully published. In combination with the `--diffcheck` parameter in the Build commands, the tags enable significant time-saving by comparing the latest tag with the source code - and only building the package if a change is found.

{% hint style="info" %}
Ensure that the `--pushgittag` parameter is also passed to the Publish command. This parameter assumes that you are already authenticated to the Version Control System.
{% endhint %}

## Publishing to NPM Compatible private registry

To publish to a NPM compatible private registry, you need the following

* A NPM Compatible private registry, here are some links on different registries and their documentation
  * Github [https://docs.github.com/en/packages/guides/configuring-npm-for-use-with-github-packages](https://docs.github.com/en/packages/guides/configuring-npm-for-use-with-github-packages)
  * Gitlab [https://docs.gitlab.com/ee/user/packages/npm\_registry/](https://docs.gitlab.com/ee/user/packages/npm_registry/)
  * Azure Artifacts [https://docs.gitlab.com/ee/user/packages/npm\_registry/](https://docs.gitlab.com/ee/user/packages/npm_registry/)
  * JFrog Artifactory [https://www.jfrog.com/confluence/display/JFROG/npm+Registry](https://www.jfrog.com/confluence/display/JFROG/npm+Registry)
  * MyGet [https://docs.myget.org/docs/reference/myget-npm-support](https://docs.myget.org/docs/reference/myget-npm-support)
* Follow the instructions on your npm registry to generate .[npmrc](https://docs.npmjs.com/cli/v7/configuring-npm/npmrc) file with the correct URL and access token \(which has the permission to publish into your registry.
* Utilize the parameters in sfpowercripts:orchestrator:publish and provide the npmrc file along with activating npm

```text
"npm":  Upload artifacts to a pre-authenticated private npm registry
"scope": (required for NPM) User or Organisation scope of the NPM package
"npmtag": Add an optional distribution tag to NPM packages. If not provided
          the 'latest' tag is set to the published version
"npmrcpath": Path to .npmrc file used for authentication to registry.
              If left blank, defaults to home directory
```

## Publishing to Universal artifacts compatible private registry

You will need to provide a publishing script as a hook to the sfpowerscripts publish command. This will be in turn utilized by sfpowerscripts to publish package to the registry.

We pass through cetrain parameters to your script, which expose the name and version of the package being published, the file path of the artifact and whether the `publishpromoteonly`flag was passed to the command. With the information available through these parameters, push the artifact to the registry using your vendor's API.

Example for Linux / MacOS

```text
# $1 package name
# $2 package version
# $3 artifact file path
# $4 isPublishPromotedOnly

myvendor artifacts push --name $1 --version $2 --path $3
```

## Publish only promoted packages

When the `--publishpromotedonly`flag is specified, only packages that have been promoted will be published to the registry.

