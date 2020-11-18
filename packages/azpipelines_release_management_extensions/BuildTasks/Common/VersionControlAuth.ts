import tl = require("azure-pipelines-task-lib/task");

export default function authVCS(repository_url: string): string {
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
    case "hostedAgentGit":
      // Agent already authenticated, return unprocessed repository url
      return repository_url;
  }

  let token: string;
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

  let removeHttps = (url: string) => url.replace(/^https?:\/\//, "");

  repository_url = removeHttps(repository_url);

  tl.debug(`Repository URL ${repository_url}`);

  let remote: string;
  if (version_control_provider == "azureRepo") {
    if (repository_url.includes("@")) {
      //Fix Issue https://developercommunity.visualstudio.com/content/problem/411770/devops-git-url.html
      repository_url = repository_url.substring(
        repository_url.indexOf("@") + 1
      );
    }
    remote = `https://x-token-auth:${token}@${repository_url}`;
  } else if (version_control_provider == "bitbucket") {
    remote = `https://x-token-auth:${token}@${repository_url}`;
  } else if (
    version_control_provider == "github" ||
    version_control_provider == "githubEnterprise"
  ) {
    remote = `https://${token}:x-oauth-basic@${repository_url}`;
  } else {
    remote = `https://${username}:${token}@${repository_url}`;
  }

  return remote;
}
