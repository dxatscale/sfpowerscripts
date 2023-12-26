# Eliminating Redundancy in Aliasified Source and Data Packages

* Status: Proposed
* Deciders: Azlam, Vu, Zhebin
* Date: 

## Context and Problem Statement

The current implementation of aliasified packages in sfpowerscripts supports a 'default' directory and environment-specific directories (e.g., `dev`, `sit`, `st`). While this structure ensures flexibility, it introduces redundancy. The contents of the 'default' directory often have to be duplicated across multiple environment-specific directories. This leads to increased maintenance complexity and greater risk of errors.

Existing Structure:

```
src-env-specific-alias-post
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

## Decision 

To alleviate the redundancy and error-prone nature of the current approach, the proposal is to introduce a layer of inheritance for aliasified packages.

Revised Structure:

```
src-env-specific-alias-post
└── main
    ├── default
    |   └── <base_contents>   
    ├── dev
    │   └── <override_contents>   
    ├── sit
    │   └── <override_contents>   
    └── st
        └── <override_contents>   
```

- sfpowerscripts will continue to try to match the `alias` as it does today.
- If an alias matches, the contents in the `<alias>` directory will be merged with the contents in the `default` directory.
  - If there's a conflict, the `<alias>` directory takes precedence.
- If the alias isn't found, it will fall back to the `default` directory.
- If neither is found, an error will be thrown.


- To ensure the changes do not disrupt exising users of the aliasfy feature, this enhanced aliasfy package feature has to be explictly enabled as 'aliasfyv2'in the sfdx-project.json


By implementing this inheritance mechanism, we reduce redundancy, simplify maintenance, and minimize the scope for errors.