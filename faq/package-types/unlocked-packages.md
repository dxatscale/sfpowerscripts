# Unlocked Packages

All the information related to unlocked package is available in the respective [developer guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_unlocked_pkg_intro.htm). This page details any additional details related to sfpowerscripts.

## Handling Dependencies for Unlocked Packages

You can define dependencies to your unlocked package as mentioned in the [Salesforce developer guides.](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev2gp_config_file.htm) Orchestrator commands such as [prepare](../../commands/prepare/#my-package-is-dependent-on-a-managed-package-or-another-unlocked-package-that-is-not-in-the-current-repository-can-this-command-do-something-about-it), [build](../../commands/build-and-quickbuild.md#how-do-these-commands-know-the-order-to-build) and [validate](../../commands/validate.md) utilize this information to install the dependencies to your org.

For any other use cases, Salesforce handles the dependency. Unlocked packages will only succeed in installation if the dependencies are available in the target org.

## Build Options with Unlocked Packages

Unlocked packages have two build modes, one with [skip dependency check](../../commands/build-and-quickbuild.md) and one without. A package being built without skipping dependency check cant be deployed into production and can usually take a long time to build. sfpowerscripts tries to build packages in parallel understanding your dependency, however some of your packages could spend a significant time in validation.

During these situations, we ask you to consider whether the time taken to build all validated packages on an average is within your build budget, If not, here are your options

* [Move to org dependent package](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_unlocked_pkg_org_dependent.htm): Org-dependent unlocked packages are a variant of unlocked packages. Org-dependent packages do not validate the dependencies of a package and will be faster. However please note that all the org's where the earlier unlocked package was installed, had to be deprecated and the component locks removed, before the new org-dependent unlocked package is installed.
* [Move to source-package:](source-packages.md)  Use it as the least resort, source packages have a fairly loose lifecycle management.

## Handling metadata that is not supported by unlocked packages

Create a [source package](source-packages.md) and move the metadata and any associated dependencies over to that particular package.

