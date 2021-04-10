---
description: When you are stuck!
---

# Troubleshooting

## Why do I get InvalidPackageDirectory error during validation and deployment tasks?

**Stage:** Validation, Deployment  
**Build Task:** Deploy a Source Directory \(Source Format\) to an Org

```text
sfpowerscripts... Deploy Source to Org
Converting source to mdapi
Converting to MDAPI Format force-app in project directory
ERROR running force:source:convert:  InvalidPackageDirectory
Unable to convert source for directory force-app
##[error]Command failed: npx sfdx force:source:convert -r force-app  -d QTcO4_mdapi
ERROR running force:source:convert:  InvalidPackageDirectory
```

**Possible Resolution:**  
Check that all your defined packages in `sfdx-project.json` has at least 1 file in the package directory so that the `sfdx cli` detects that the package exists and is valid. During the mdapi conversion process, it will reference the `sfdx-project.json` file before starting to convert the specified package.

## Why am I getting a SyntaxError:Unexpected token exception when I use any of these commands?

Check that all your defined packages in `sfdx-project.json` have these following attributes defined

```text
package:<name-of-the-package> // this is mandatory for each of the packages
versionNumber:<X.Y.Z.BuildNumber/NEXT> //this is mandatory for each of the packages
versionName:<any-version_name>
```

## Why am I getting the below error during prepare/validate command?

![](../.gitbook/assets/image%20%2811%29.png)

This error is thrown when sfpowerkit is unable to fetch information about the dependencies of a package. Check for the following

* There is a valid alias for package dependencies for any of the unlocked /source packages  
* Unlocked packages are found to refer to a source package dependency

## Why do some scratch org's fail during pool creation?

Occasionally you will find errors like the below one during the pool creation, this is mainly due to the created scratch org, not available for further operations. We have found that to be quite rare. Only that particular scratch org will be skipped and the commands will continue as expected for other scratch org's

```text
Error: getaddrinfo ENOTFOUND page-drive-4000-dev-ed.cs73.my.salesforce.com
    at GetAddrInfoReqWrap.onlookup [as oncomplete] (node:dns:67:26) {
  errno: -3008,
  code: ‘ENOTFOUND’,
  syscall: ‘getaddrinfo’,
  hostname: ‘page-drive-4000-dev-ed.cs73.my.salesforce.com’
}
```

