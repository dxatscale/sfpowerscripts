# sfpowerscripts-artifact

Install the 'sfpowerscripts-artifact' unlocked package to your orgs using the SFDX CLI:

```bash
  sfdx force:package:install --package 04t1P000000ka9mQAA -u <org> --securitytype=AdminsOnly --wait=120
```

The sfpowerscripts-artifact package is a lightweight unlocked package consisting of a custom setting `SfpowerscriptsArtifact2__c` that is used to keep record of the artifacts that have been installed in the org. This enables package installation, using sfpowerscripts, to be skipped if the same artifact version already exists in the org.

The source code for the unlocked package is provided here in the event that you would like to create the package in your own Dev Hub.

The `sfdx sfpowerscripts:orchestrator:prepare` command automatically installs our version of the sfpowerscripts-artifact package to the scratch orgs. To use your own package version, provide the
'04t' ID as an environment variable before running the `prepare` command:

```bash
  $ export SFPOWERSCRIPTS_ARTIFACT_PACKAGE=04tXXXXXXXXXXXXXXX
```
