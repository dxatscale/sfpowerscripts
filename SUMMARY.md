# Table of contents

* [Overview](README.md)
* [Principles](principles-1.md)

## Azure Pipelines

* [Getting Started](azure-pipelines/getting-started.md)
* [Build your pipelines](azure-pipelines/pipelines/README.md)
  * [Pull Request Validation using Scratch Org](azure-pipelines/pipelines/pull-request-validation-using-scratch-org.md)
  * [Build Pipeline - Org Based Deployment](azure-pipelines/pipelines/continous-integration-pipeline-org-based.md)
  * [Build Pipeline - Unlocked Package](azure-pipelines/pipelines/continous-integration-pipeline-unlocked-package.md)
  * [Release Pipeline - Org Based Deployment](azure-pipelines/pipelines/release-pipeline-org-development.md)
  * [Release Pipeline - Unlocked Package Based Deployment](azure-pipelines/pipelines/release-pipeline-unlocked-package.md)
* [Task Specifications](azure-pipelines/task-specifications/README.md)
  * [Authentication Tasks](azure-pipelines/task-specifications/authentication/README.md)
    * [Connecting to Salesforce Org using ServiceConnection](azure-pipelines/task-specifications/authentication/connecting-to-salesforce-using-serviceconnection.md)
    * [Authenticate a Salesforce Org](azure-pipelines/task-specifications/authentication/authenticate-an-org.md)
  * [Utility Tasks](azure-pipelines/task-specifications/utility-tasks/README.md)
    * [Install SFDX CLI with sfpowerkit](azure-pipelines/task-specifications/utility-tasks/install-sfdx-cli-with-sfpowerkit.md)
    * [Create/Delete a Scratch Org](azure-pipelines/task-specifications/utility-tasks/create-delete-a-scratch-org.md)
    * [Export Metadata from an org](azure-pipelines/task-specifications/utility-tasks/export-metadata-from-an-org.md)
    * [Install package dependencies](azure-pipelines/task-specifications/utility-tasks/install-package-dependencies.md)
    * [Increment Version Number of a package](azure-pipelines/task-specifications/utility-tasks/increment-version-number-of-a-package.md)
  * [Packaging Tasks](azure-pipelines/task-specifications/packaging-tasks/README.md)
    * [Validate Unlocked Package for Metadata Coverage](azure-pipelines/task-specifications/packaging-tasks/validate-unlocked-package-for-metadata-coverage.md)
    * [Creates a new  version of  Source Based Package](azure-pipelines/task-specifications/packaging-tasks/create-source-based-package.md)
    * [Create a Delta Package](azure-pipelines/task-specifications/packaging-tasks/create-a-delta-package.md)
    * [Create a new version of Unlocked Package](azure-pipelines/task-specifications/packaging-tasks/create-a-new-version-of-unlocked-package.md)
    * [Promote an Unlocked Package](azure-pipelines/task-specifications/packaging-tasks/promote-an-unlocked-package.md)
    * [Execute Post Steps after Creating a Package](azure-pipelines/task-specifications/packaging-tasks/execute-post-steps-after-creating-a-package.md)
  * [Deployment Tasks](azure-pipelines/task-specifications/deployment-tasks/README.md)
    * [Checkout the project from repository for the associated artifact](azure-pipelines/task-specifications/deployment-tasks/checkout-a-build-artifact.md)
    * [Deploy a Package \(Source Format\) to an Org](azure-pipelines/task-specifications/deployment-tasks/deploy-a-source-repo-to-org.md)
    * [Deploy Destructive Maifest to an org](azure-pipelines/task-specifications/deployment-tasks/deploy-destructive-maifest-to-an-org.md)
    * [Install an Unlocked Package to an org](azure-pipelines/task-specifications/deployment-tasks/install-an-unlocked-package-to-an-org.md)
  * [Testing Tasks](azure-pipelines/task-specifications/testing-tasks/README.md)
    * [Trigger Apex Test](azure-pipelines/task-specifications/testing-tasks/trigger-apex-test.md)
    * [Validate Apex Test Coverage](azure-pipelines/task-specifications/testing-tasks/validate-apex-test-coverage.md)
    * [Validate Code Coverage of a Package](azure-pipelines/task-specifications/testing-tasks/validate-code-coverage-of-a-package.md)
    * [Run a static analysis of apex classes with PMD](azure-pipelines/task-specifications/testing-tasks/run-a-static-analysis-of-apex-classes-with-pmd.md)
* [Troubleshooting](azure-pipelines/troubleshooting.md)

## CLI

* [Using sfpowerscripts-cli sfdx extension](cli/getting-started.md)

---

* [FAQ's](faqs.md)
* [Change Log](change-log.md)
* [Maintainers](maintainers.md)
* [Contributors](contributors.md)
* [Contributing to sfpowerscripts](contributing-to-sfpowerscripts.md)

