# Table of contents

* [Overview](README.md)

## Concepts <a id="concepts-1"></a>

* [Separation between build and deployment stages](concepts-1/separation-between-build-and-deployment-stages.md)
* [Source Packages](concepts-1/source-driven-packages.md)
* [Artifacts over branches](concepts-1/artifacts-over-branches.md)

## Azure Pipelines <a id="azure-pipelines-1"></a>

* [Getting Started](azure-pipelines-1/getting-started.md)
* [Pipelines](azure-pipelines-1/pipelines/README.md)
  * [Pull Request Validation using Scratch Org](azure-pipelines-1/pipelines/pull-request-validation-using-scratch-org.md)
  * [Continous Integration Pipeline - Org Based](azure-pipelines-1/pipelines/continous-integration-pipeline-org-based.md)
  * [Continous Integration Pipeline - Unlocked Package](azure-pipelines-1/pipelines/continous-integration-pipeline-unlocked-package.md)
  * [Release Pipeline - Unlocked Package](azure-pipelines-1/pipelines/release-pipeline-unlocked-package.md)
  * [Release Pipeline - Org Development](azure-pipelines-1/pipelines/release-pipeline-org-development.md)
* [Service Connection](azure-pipelines-1/service-connection/README.md)
  * [Connecting to Salesforce using ServiceConnection](azure-pipelines-1/service-connection/connecting-to-salesforce-using-serviceconnection.md)
* [Task Specifications](azure-pipelines-1/task-specifications/README.md)
  * [Authentication Tasks](azure-pipelines-1/task-specifications/authentication/README.md)
    * [Authenticate a Salesforce Org](azure-pipelines-1/task-specifications/authentication/authenticate-an-org.md)
  * [Utility Tasks](azure-pipelines-1/task-specifications/utility-tasks/README.md)
    * [Install SFDX CLI with SFPowerkit](azure-pipelines-1/task-specifications/utility-tasks/install-sfdx-cli-with-sfpowerkit.md)
    * [Create/Delete a Scratch Org](azure-pipelines-1/task-specifications/utility-tasks/create-delete-a-scratch-org.md)
    * [Export Metadata from an org](azure-pipelines-1/task-specifications/utility-tasks/export-metadata-from-an-org.md)
    * [Install Package Dependencies](azure-pipelines-1/task-specifications/utility-tasks/install-package-dependencies.md)
    * [Increment Version Number of a package](azure-pipelines-1/task-specifications/utility-tasks/increment-version-number-of-a-package.md)
  * [Packaging Tasks](azure-pipelines-1/task-specifications/packaging-tasks/README.md)
    * [Validate Unlocked Package for Metadata Coverage](azure-pipelines-1/task-specifications/packaging-tasks/validate-unlocked-package-for-metadata-coverage.md)
    * [Create Source based Package](azure-pipelines-1/task-specifications/packaging-tasks/create-source-based-package.md)
    * [Create a Delta Package](azure-pipelines-1/task-specifications/packaging-tasks/create-a-delta-package.md)
    * [Create a new version of Unlocked Package](azure-pipelines-1/task-specifications/packaging-tasks/create-a-new-version-of-unlocked-package.md)
    * [Promote an Unlocked Package](azure-pipelines-1/task-specifications/packaging-tasks/promote-an-unlocked-package.md)
  * [Deployment Tasks](azure-pipelines-1/task-specifications/deployment-tasks/README.md)
    * [Checkout a build artifact](azure-pipelines-1/task-specifications/deployment-tasks/checkout-a-build-artifact.md)
    * [Deploy a Source Package to Org](azure-pipelines-1/task-specifications/deployment-tasks/deploy-a-source-repo-to-org.md)
    * [Deploy Destructive Maifest to an org](azure-pipelines-1/task-specifications/deployment-tasks/deploy-destructive-maifest-to-an-org.md)
    * [Install an Unlocked Package to an org](azure-pipelines-1/task-specifications/deployment-tasks/install-an-unlocked-package-to-an-org.md)
  * [Testing Tasks](azure-pipelines-1/task-specifications/testing-tasks/README.md)
    * [Trigger Apex Test](azure-pipelines-1/task-specifications/testing-tasks/trigger-apex-test.md)
    * [Validate Apex Test Coverage](azure-pipelines-1/task-specifications/testing-tasks/validate-apex-test-coverage.md)
    * [Validate Code Coverage of a Package](azure-pipelines-1/task-specifications/testing-tasks/validate-code-coverage-of-a-package.md)
    * [Run a static analysis of apex classes with PMD](azure-pipelines-1/task-specifications/testing-tasks/run-a-static-analysis-of-apex-classes-with-pmd.md)

## CLI

* [Getting Started](cli/getting-started.md)

---

* [Change Log](change-log.md)
* [Contributing to sfpowerscripts](contributing-to-sfpowerscripts.md)

