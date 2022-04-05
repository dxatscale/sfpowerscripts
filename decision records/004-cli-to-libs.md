# Promote open source @salesforce node libraries as opposed to wrapping over CLI

• Status: Approved

• Issue: #883 #876 #847 #841 

## Context and Problem Statement

sfpowerscripts originated as an easy to use wrapper over the Salesforce CLI commands for use in Azure Pipelines (in classic mode). This enabled Salesforce developers to drag and drop tasks to create a workflow easily. Over the time, sfpowerscripts evolved into an orchestrator for modular package based development as a CLI plugin. However many of the underyling code base still utilized the existing wrappers over Salesforce CLI commands. This has lead into the following issues

- Tight dependency on SFDX CLI versions

    Everytime a new version of sfpowerscripts is released, we have to do a compatibility testing to ensure it is compatible with latest version of the CLI (available at that point in time).These versions are then displayed as badges in the repository. Many projects who utilize their own docker images along with sfpowerscripts have to ensure the correct version of compatible cli is used with sfpowerscripts. Users are often confused on whether updating the sfdx cli , for bug fixes that are not related to the functionality used by sfpowerscripts will break the orchestrator. Also for the development team, this is a take it all or nothing approach, to fix a certain bug say in apex testing (introduced by a new version of the cli), any potential changes in the flags for other commands have to be retrofitted.

- Use of additional REST api's over and above what is provided by sfdx-cli

    sfpowerscripts utilizes the sfdx-cli as one of the api surface it interacts with.  The sfdx-cli is multi faceted and have to satisfy different use cases ranging from executed from a local terminal to CI/CD server. This often results in responses being formatted and presented to the user in the most apt mechanism. sfpowerscripts as an orchestrator, sometimes need to utilize additional information not available through these responses and have to resort to additional api  calls anyway.
  
- Unnecessary processing due to usage of cli as an api

    sfpowerscripts dependency on the cli through the --json flag, makes it really difficult to display progress information for a particular operation. Consider the example of displaying a progress for mdapi deploy (used behind the scene for source ), this result in the following seqeuence of activities

      a). Trigger a deploy without waiting for results to retrieve the deploy id (mdapi:deploy)
      b). Use the deploy id to fetch the status display progress information over a polling interval (mdapi:deploy:report)
      c). Fetch the final report and then proceed with the appropriate coure of action (mdapi:deploy:report)
    All these activites were using wrappers over cli, as each cli call happens, the cli has to reauthenticate, do its processing  and then provide a json response to sfpowerscripts for its process. Though this was considerably quick, from an overall scheme of things, many of these extra calls results in too many additional api calls and file operations. 

## Decision

As the salesforce team eventually split their cli into multiple packages from toolbelt as part of the open source (https://developer.salesforce.com/blogs/2021/02/open-sourcing-salesforce-cli-update-feb-2021), this becomes more easier rather than wrapping around REST API's, the sfdx-cli team is exposing the underlying functionality as modular node libraries. This allows the sfpowerscripts team to address functionality in much more easier manner and also able to create an accurate test bed that is able to test sfpowerscripts with pinned down versions of these libs. Also this would allow development team to pick and chose different version of the libraries in case of there is a breaking API change rather than the current take it all approch with the newer cli version. The downside to these approach being there will be areas, in code, where we have to replicate behaviours done by the cli, such as test result formatters. Also any bug fixes in the underlying library has to be carried over to sfpowerscripts as soon as possible.  

Our goal is to utilize these modules as and when it is available, during each releases, the dx@scale team would refactor the current implementation to utilize these libraries and provide updates to sfpowerscripts through a faster release cadence.
