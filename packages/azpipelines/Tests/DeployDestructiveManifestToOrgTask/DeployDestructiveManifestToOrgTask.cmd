SET INPUT_TARGET_ORG=test_ci_demo
SET INPUT_METHOD=FilePath
SET INPUT_DESTRUCTIVE_MANIFEST_FILEPATH=C:\Projects\force-di\destructiveChanges.xml




ts-node ..\..\BuildTasks\DeployDestructiveManifestToOrgTask\DeployDestructiveManifestToOrg.ts