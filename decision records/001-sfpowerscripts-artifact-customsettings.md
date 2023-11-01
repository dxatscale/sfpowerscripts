# Migrate sfpowerscripts artifact to utilize custom settings instead of a custom object

* Status: Accepted <!-- optional -->
* Deciders: Azlam, Alan <!-- optional -->
* Date: <!-- optional -->

Issue [Issue #476](https://github.com/dxatscale/sfpowerscripts/issues/476) <!-- optional -->

## Context and Problem Statement

sfpowerscripts artifacts is an unlocked package that keeps track of all the packages installed in the org. The current implementation utilizes a custom object to store the information. However, this has a downside, that when an org gets refreshed, the entire data gets wiped out and the traceability is lost.

To solve this, these records should be stored in custom settings, which are preserved during refreshes. The cli should support utilising custom settings to store these records with a backward compatibility layer, so that none of the data gets lost while the migration is underway


## Decision


This migration will be done in the following manner in the intermediate release
- CLI commands to check for the existence of sfpowerscripts_artifact_c object and any associate records on every run
- If associated records are found, proceed to migrate all the existing records into the newly created custom setting object
- Delete all the records in sfpowerscripts_artifact_c object.
- Utilize custom settings moving forward

An upgrade to sfpowerscripts_package will be pushed to all the users who are utilizing the package and rest of them will be asked to build from source and deploy a package to the org

On a subsequent release, the custom object will be deprecated and CLI commands will remove the associated check and migration code


## Consequences <!-- optional -->

There will be a slight delay during deploy command, as it has to check for the existence. But once this migration is over it will be provide better accuracy and tie it back to the exact version of the package even when the org is refreshed from another one.


<!-- markdownlint-disable-file MD013 -->
