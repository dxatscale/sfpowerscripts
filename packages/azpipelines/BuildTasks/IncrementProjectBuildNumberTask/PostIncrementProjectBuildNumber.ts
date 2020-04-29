import tl = require("azure-pipelines-task-lib/task");
import { AppInsights } from "../Common/AppInsights";
import simplegit from "simple-git/promise";

async function run() {
  try {



    
    //#Bug fix for Issue #199 .. Support for backward compatiblity, where the push is still on an is hidden when appendBuildNumber is selected
    const isappendBuildNumber =  tl.getBoolInput("appendBuildNumber", false);
    if(isappendBuildNumber)
    {
        return;
    }



    AppInsights.setupAppInsights(tl.getBoolInput("isTelemetryEnabled", true));

    const isPushChanges = tl.getBoolInput("pushchanges", false);
    const pushOption = tl.getInput("pushoption", false);




    let isToBePushed =
      pushOption == "onSuccess"
        ? tl.getVariable("Agent.JobStatus") == "Succeeded"
        : true;

    if (isPushChanges) {
      if (isToBePushed) {
        const version_control_provider: string = tl.getInput(
          "versionControlProvider",
          true
        );

        let connection: string;
        switch (version_control_provider) {
          case "github":
            connection = tl.getInput("github_connection", true);
            break;
          case "githubEnterprise":
            connection = tl.getInput("github_enterprise_connection", true);
            break;
          case "bitbucket":
            connection = tl.getInput("bitbucket_connection", true);
            break;
        }

        let token;
        let username: string;
        if (version_control_provider == "azureRepo") {
          token = tl.getVariable("system.accessToken");
        } else if (
          version_control_provider == "github" ||
          version_control_provider == "githubEnterprise"
        ) {
          token = tl.getEndpointAuthorizationParameter(
            connection,
            "AccessToken",
            true
          );
        } else if (version_control_provider == "bitbucket") {
          token = tl.getEndpointAuthorizationParameter(
            connection,
            "AccessToken",
            true
          );
        } else {
          username = tl.getInput("username", true);
          token = tl.getInput("password", true);
        }
        //Strip https
        const removeHttps = input => input.replace(/^https?:\/\//, "");

        let repository_url = removeHttps(
          tl.getVariable("Build.Repository.Uri")
        );

        tl.debug(`Repository URL ${repository_url}`);

        const git = simplegit(tl.getVariable("Build.Repository.LocalPath"));

        let remote: string;
        if (version_control_provider == "azureRepo") {
          //Fix Issue https://developercommunity.visualstudio.com/content/problem/411770/devops-git-url.html
          repository_url = repository_url.substring(
            repository_url.indexOf("@") + 1
          );
          remote = `https://x-token-auth:${token}@${repository_url}`;
        } else if (version_control_provider == "bitbucket") {
          remote = `https://x-token-auth:${token}@${repository_url}`;
        } else if (
          version_control_provider == "github" ||
          version_control_provider == "githubEnterprise"
        ) {
          remote = `https://${token}:x-oauth-basic@${repository_url}`;
        } else if (version_control_provider == "otherGit") {
          remote = `https://${username}:${token}@${repository_url}`;
        }

        await git
          .silent(false)
          .push(
            remote,
            `HEAD:${tl
              .getVariable("Build.SourceBranch")
              .substring(
                tl.getVariable("Build.SourceBranch").indexOf("/", 5) + 1
              )}`
          );
        console.log(
          `Pushed Incrmented sfdx-project.json to repository ${repository_url}`
        );
      } else {
        console.log("Skipping push to repository as previous tasks has failed");
      }
    }

    AppInsights.trackTask("sfpwowerscript-incrementversionnumber-task");
    AppInsights.trackTaskEvent(
      "sfpwowerscript-incrementversionnumber-task",
      "git_pushed"
    );
  } catch (err) {
    AppInsights.trackExcepiton(
      "sfpwowerscript-incrementversionnumber-task",
      err
    );
    tl.setResult(tl.TaskResult.Failed, err.message);
  }
}

run();
