# Aliasified Source and Data Packages

* Status: Accepted  <!-- optional -->
* Deciders: Azlam, Alan <!-- optional -->
* Date:  <!-- optional -->

Issue [Issue #632](https://github.com/dxatscale/sfpowerscripts/issues/632)
Issue [Issue #715](https://github.com/dxatscale/sfpowerscripts/issues/715)


## Context and Problem Statement

sfpowerscripts support the concept of aliasisifed data and source packages, with the idea being a single package can have variants identified by aliases of an org and deployment will utilize the particular variant to be deployed to an org.  For eg: consider the below aliasified package

```
src-env-specicific-alias-post
├── README.md
├── dev
│   └── <contents>
├── sit
│   └── <contents>
└── st
    └── <contents>

```
sfpowerscripts matches the alias of the org ( depending on the alias that was set during the time of authentication), with a folder with the same name and deploy contents. As the number of orgs grow in the path to production, the content need to duplicate across each environment in the pathway or else sfpowerscripts will not allow the package to be deployed.  This is also concerning around deployment to scratch org, as this package has to be ignored.

## Decision 


To solve the above problem statement and issues, it is decided for sfpowerscripts to support a 'default' folder in aliasified packages.  The revised structure would be as follows
```
src-env-specific-alias-post
├── README.md
└── main
    ├── default
    |   └── <contents>   
    ├── dev
    │   └── <contents>   
    ├── sit
    │   └── <contents>   
    └── st
        └── <contents>   

```

The behaviour would be altered in the following manner

- sfpowerscripts will try to match the `alias` provided by the user by recursively searching across the project path.
- if the alias is matched, the contents inside the <alias> directory will be deployed
- if the alias is not been able to found, sfpowerscripts will fallback to the default folder.
- if the default folder is not found, throw an error saying default folder or alias is missing.

Also to ensure care is being taken not to allow contents in default is being deployed to production, sfpowerscripts will validate the type of target org, whether its a sandbox or a prod environment. sfpowerscripts will fail to deploy aliasfied packages if it doesnt match the alias of the production environment.

The above also considers backward compatibility for existing users.



<!-- markdownlint-disable-file MD013 -->
