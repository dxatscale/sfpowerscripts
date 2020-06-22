import tl = require("azure-pipelines-task-lib/task");

async function run() {
  const isGitTag: boolean = tl.getBoolInput("isGitTag", false);
  const sfdx_package: string = tl.getInput("package", true);

  if (isGitTag) {
    console.log(
      `Checking whether Post Package Create Task is added to the pipeline as ${isGitTag} is enabled for ${sfdx_package}`
    );
    let isPostPackageTaskExecuted: string = tl.getVariable(
      "post_package_task_executed"
    );

    if (isPostPackageTaskExecuted != "true") {
      tl.setResult(
        tl.TaskResult.SucceededWithIssues,
        `Post Package Task not executed/added in the pipeline, Please add it at the end of package creation commands!`
      );
    }
  }
}

run();
