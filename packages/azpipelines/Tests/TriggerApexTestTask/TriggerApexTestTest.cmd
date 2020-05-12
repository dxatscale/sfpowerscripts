SET INPUT_TARGET_ORG=MyScratchOrg
SET INPUT_TESTLEVEL=RunLocalTests
SET INPUT_WAIT_TIME=60
SET build.artifactStagingDirectory="staging"
SET INPUT_ISTELEMETRYENABLED=false



ts-node  --project  ..\..\BuildTasks\TriggerApexTestTask\tsconfig.json  ..\..\BuildTasks\TriggerApexTestTask\TriggerApexTest.ts

