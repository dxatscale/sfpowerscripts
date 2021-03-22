---
description: Systematic approach to fetching artifacts from a registry
---

# Fetch

The `artifacts:fetch` command provides a systematic method of fetching artifacts from an artifact repository. Each call to the command requires a `release-definition.yml` file which contains the name of the artifacts that you want to download, and a mapping to the version to download. If fetching from a **NPM registry**, the command will handle everything else for you. However, for universal artifacts there is no uniform method for downloading artifacts from a repository, so you will need to provide a shell script that calls the relevant API.    

```text
# release-definition.yml

release: "myrelease"
artifacts:
  mypackageA: alpha # Supports NPM tags
  mypackageB: LATEST_TAG # Substituted with version from latest git tag at runtime
  mypackageC: 1.2.3-5 # Provide the exact version to download
```

## Fetching universal artifacts 

For universal artifacts, there is no uniform method for downloading artifacts from a registry, so you will need to provide a shell script that calls the relevant API.

There are multiple parameters available in the shell script. Pass these parameters to the API call, and at runtime they will be substituted with the corresponding values:

1. Artifact name
2. Artifact version
3. Directory to download artifacts 

**Eg.** **Fetching from Azure Artifacts using the Az CLI on Linux**

```text
#!/bin/bash

# $1 - artifact name
# $2 - artifact version
# $3 - artifact directory 

echo "Downloading Artifact $1 Version $2"

az artifacts universal download --feed myfeed --name $1 --version $2 --path $3 \
    --organization "https://dev.azure.com/myorg/" --project myproject --scope project

```

 

