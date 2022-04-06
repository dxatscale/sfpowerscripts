# Automated Retry Apex Testing In Synchronous Mode

• Status: Approved
• Issue: #836

## Context and Problem Statement

During validate stage, sfpowerscripts triggers apex testing for each package and validates the code coverage. This feature provides early feedback to the developer in terms of code coverage and validates the following

    - All apex tests are executed successfully
    - Validate apex code coverage for each package in the following manner
      - For Source Package, each individual apex class have more than 75% of coverage or more
      - For Unlocked Packages, each package has an overall coverage of more than 75% of coverage or more

These tests are by default triggered asynchronously (in parallel), with a request to calculate coverage as well.  Most projects however find it really difficult to get all the test of package to execute synchronously. After confirming with Salesforce Product team, tests are always triggered synchronously during Package Validation (build) or during deployment (source packages). Executing tests synchronously is extremely consuming on packages with larger number of test classes.

There are also situations where bulk of the apex test in a package can be executed asynchronously with a few test cases that need to be triggered in synchronous mode.

A recently surfaced issue (#836), have uncovered coverage calculation becoming erratic randomly. This is attributed to the fact that asynchronous tests may trigger parallel compilation of classes under test and code coverage calculation is skipped.

## Decision

sfpowerscripts will collect all the test classes that failed in an asynchronous run due to 'UNABLE_TO_LOCK_ROW' or 'Your request exceeded the time limit for processing' and trigger these tests in synchronous mode.

sfpowerscripts will also figure out any tests classes that were not able to contribute to code coverage and execute them synchronously. As the current test api has limitation on how tests could be triggered synchronously (only one test class is allowed), sfpowerscripts will change the mode of the org to 'Disable Parallel Testing' by changing the apex setting as mentioned [ here](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_apexsettings.htm). sfpowerscripts will utilize jsforce update (http://jsforce.github.io/jsforce/doc/Metadata.html) to update this setting on the fly.
 Once the setting is succesfully toggled, it will  proceed to execute these tests using asynchronous payload, which is equivalent to triggering test classes synchronously. The coverage results are then converged and new coverage value is calculated

The retry is only attempted once and provided there is no other failures in the first run other than the issues mentioned above
