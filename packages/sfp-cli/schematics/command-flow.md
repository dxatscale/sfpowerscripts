Using sfdx cli in terminal is often verbose and needs to remember an exact sequence of steps to get the desired outcome. For developers who are familiar with terminals, interacting with cli eventually becomes muscle memory. sfp-cli is meant to address the gap for a beginner getting started on the dx@scale journey

**Philosophy**

-   No flags
-   No need to remember which commands to be used and in what order
-   Rely on confirmation and prompts
-   Confirm users to a process, if they move away from the process, this CLI is not for you.

**Commands**

**sfp init**

-   Initializes defaults by prompting for user (devhub, devpool, main branch)
-   Future
    -   Ask for repository provider
    -   Install repository providers'cli or checks whether the tools are reachable
    -   sfdx cli verification

**sfp workitem**

-   Helper commands to help with work items
-   WorkOn new item (cut a branch from default (prompt) , fetch/create a new dev org )
-   Swtich to existing item ( assuming you have the branch locally ) -
-   Submit
    -   pull from repo
    -   pre submit checks (pmd? package valid, dependency check).
    -   push to org (optional?),
    -   commit and push
    -   create pr (future)
        -   Using repository provider's cli (eg: gh, bitbucket?, ado?, gitlab-cli)

**sfp sync**

-   Sync to/from Git ( you are not on the default branch!!!, your branch could be shared by two devs) <-- main to local & push local
    -   Pull from remote tracking branch
    -   Pull from parent branch
    -   Prompt for push to remote tracking branch
-   Sync to/from Org ( push/pull to the org)
-   Sort medatata into packages by utilizing dx@scale's recommended repo structure
-   Improve recommendations using dynamic dependency (future)

| Local Changes | Remote Changes | Sync Direction                                    |
| ------------- | -------------- | ------------------------------------------------- |
| X             |                | Push                                              |
|               | X              | Pull                                              |
| X             | X              | Both Conflict? -> Yes ask user for sync direction |
