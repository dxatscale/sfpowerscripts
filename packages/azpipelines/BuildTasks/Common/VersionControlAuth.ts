import tl = require("azure-pipelines-task-lib/task");

export default async function auth(): Promise<string> {
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
    return getRepositoryUrl();
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

    let repository_url = getRepositoryUrl();

    tl.debug(`Repository URL ${repository_url}`);

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

    return remote;
}

function getRepositoryUrl(): string {
    let url = tl.getVariable("Build.Repository.Uri");
    // Return repoistory URL without https
    return url.replace(/^https?:\/\//, "");
}
