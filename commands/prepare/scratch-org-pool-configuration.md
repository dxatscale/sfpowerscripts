# Scratch Org Pool Configuration

{% hint style="info" %}
The latest JSON schema for scratch org pool configuration can be found [here](https://github.com/Accenture/sfpowerscripts/blob/develop/packages/sfpowerscripts-cli/resources/schemas/pooldefinition.schema.json). 
{% endhint %}

The `orchestrator:prepare` command accepts a JSON configuration file that defines settings and attributes of the scratch org pool. The properties accepted by the configuration file are shown in the table below.

| Property | Type | Description |
| :--- | :--- | :--- |
| tag | string | Name used to identify the scratch org pool |
| expiry | int | Number of days for which the scratch orgs are active |
| maxAllocation | int | Maximum capacity of the pool |
| batchSize | int | Number of processes for creating scratch orgs in parallel |
| configFilePath | string | Path to scratch org definition JSON file |
| succeedOnDeploymentErrors | boolean | Whether to persist scratch org to the pool for a deployment error |
| installAll | boolean | Install all package artifacts, in addition to the managed package dependencies |
| enableSourceTracking | boolean | Enable source tracking by deploying packages using source:push and persisting source tracking files |
| relaxAllIPRanges | boolean | Relax all IP addresses, allowing all global access to scratch orgs |
| ipRangesToBeRelaxed | array | Range of IP addresses that can access the scratch orgs |
| retryOnFailure | boolean | Retry installation of a package on a failed deployment |
| fetchArtifacts | object | Fetch artifacts, to be deployed to scratch orgs, from an artifact registry  |
| fetchArtifacts.artifactFetchScript | string | Path to the shell script containing logic for fetching artifacts from a universal registry, if not using npm |
| fetchArtifacts.npm | object | Fetch artifacts from NPM registry |
| fetchArtifacts.npm.scope | string | Scope of the NPM package |
| fetchArtifacts.npm.npmtag | string | Tag of NPM packages \(usually the name of the branch from which the artifacts were created\) |

### Sample configuration files

#### Install artifacts from Universal registry, using a shell script

```text
{
    "tag": "DEV-POOL",
    "maxAllocation": 20,
    "expiry": 10,
    "batchSize": 10,
    "configFilePath": "config/project-scratch-def.json",
    "relaxAllIPRanges": true,
    "installAll": true,
    "enableSourceTracking": true,
    "retryOnFailure": true,
    "succeedOnDeploymentErrors": true,
    "fetchArtifacts": {
        "artifactFetchScript": "path/to/artifactFetchScript.sh"
    }
}
```

#### Install artifacts from NPM registry

```text
{
    "tag": "DEV-POOL",
    "maxAllocation": 20,
    "expiry": 10,
    "batchSize": 10,
    "configFilePath": "config/project-scratch-def.json",
    "relaxAllIPRanges": true,
    "installAll": true,
    "enableSourceTracking": true,
    "retryOnFailure": true,
    "succeedOnDeploymentErrors": true,
    "fetchArtifacts": {
        "npm": {
            "scope": "myproject",
            "npmtag": "branchName"
    }
}
```

