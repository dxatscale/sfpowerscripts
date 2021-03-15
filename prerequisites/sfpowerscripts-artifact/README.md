# sfpowerscripts-artifact

<TODO: Add description>

## Installation Instructions
### Installing the Unlocked package to your DevHub from URL

1. Login to your DevHub
2. Click [here](https://login.salesforce.com/packaging/installPackage.apexp?p0=<TBC>) to install the **sfpowerscripts-artifact** unlocked package into your DevHub.
3. Select **Install for Admin Only**

### Installing the Unlocked package to your DevHub from CLI

```
sfdx force:package:install -p <TBC> -u Devhub -r -a package -s AdminsOnly -w 30
```

### Deploy the app to your DevHub from CLI

```
git clone https://github.com/Accenture/sfpowerscripts

cd sfpowerscripts/prerequisites/sfpowerscripts-artifact

sfdx force:source:deploy -p force-app -u Devhub -w 30
```

## Assign permission set to Admin/CI user
<TODO: Add description>

## sfpowerscripts-artifact to Scaratch org

<TODO: update description>
The sfpowerscripts-artifact package is a lightweight unlocked package consisting of an object `SfpowerscriptsArtifact__c` that is used to keep record of the artifacts that have been installed in the org. This enables package installation, using sfpowerscripts, to be skipped if the same artifact version already exists in the org.

The source code for the unlocked package is provided here in the event that you would like to create the package in your own Dev Hub.

The `sfdx sfpowerscripts:orchestrator:prepare` command automatically installs our version of the sfpowerscripts-artifact package to the scratch orgs. To use your own package version, provide the
'04t' ID as an environment variable before running the `prepare` command:

```bash
  $ export SFPOWERSCRIPTS_ARTIFACT_PACKAGE=04tXXXXXXXXXXXXXXX
```
