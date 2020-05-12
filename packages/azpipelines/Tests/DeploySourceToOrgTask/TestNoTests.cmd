
SET INPUT_TARGET_ORG=MyScratchOrg
SET INPUT_SOURCE_DIRECTORY=force-di
SET INPUT_PROJECT_DIRECTORY=C:\Projects\force-di
SET INPUT_WAIT_TIME=60
SET INPUT_TESTLEVEL=NoTestRun
SET INPUT_ISTOBREAKBUILDIFEMPTY=true







ts-node --project  ..\..\BuildTasks\DeploySourceToOrgTask\tsconfig.json  ..\..\BuildTasks\DeploySourceToOrgTask\DeploySourceToOrg

