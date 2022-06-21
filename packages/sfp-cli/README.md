sfp-cli
=======
[Beta] Developer CLI for Salesforce programs following the DX@Scale model.

Not comfortable with git, SFDX or the command-line? Take advantage of guided workflows provided by the sfp-cli, with its interactive prompt-driven UI.

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/@dxatscale/sfp-cli.svg)](https://npmjs.org/package/@dxatscale/sfp-cli)
[![Downloads/week](https://img.shields.io/npm/dw/@dxatscale/sfp-cli.svg)](https://npmjs.org/package/@dxatscale/sfp-cli)
[![License](https://img.shields.io/npm/l/@dxatscale/sfp-cli.svg)](https://github.com/dxatscale/sfp-cli/blob/master/package.json)

# Installation

**Prerequisites**

The sfp-cli is dependent on other modules that must be installed in order for it to work:
* [Salesforce CLI](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_install_cli.htm)
* [sfpowerkit](https://github.com/dxatscale/sfpowerkit)


**Install sfp-cli**
```
$ npm install -g @dxatscale/sfp-cli

```

# Usage
The sfp-cli may be slightly different than the CLI's that you are accustomed to using. Firstly, the sfp-cli is its own CLI, and *not* a plugin of the Salesforce CLI, which means that to start using it all you have to type into the terminal is `$ sfp`. The other key difference is that the commands do not accept any flags or arguments. Sfp-cli is designed with an interactive prompt-based UI, which is as simple as following the instruction on the screen. Try it out for yourself by typing `$ sfp [COMMAND]` in the terminal, substituting `[COMMAND]` for one of the commands listed below.
<!-- usage -->

```sh-session
$ sfp init
running command...
? Default git branch for this repo? main
? Associate a devhub with this project? Yes
? Create a new scratch org? (y/N)
...
```

## Work Items
The sfp-cli is built around the idea of work items, which are units of work usually defined on an issue tracking system like Jira. Instead of using git directly to create a new branch, in which to do development work, use `$ sfp work` to create or switch between work items, which have their own associated branch as well as development org.

## Syncing changes
The `$ sfp sync` command allows you to effortlessly sync changes between your source repository and development org. It abstracts the nitty-gritty details of git and SFDX commands into simple prompt-driven workflows, while also providing augmented functionality such as moving pulled components into packages and recommendations for packaging.

<!-- usagestop -->

# Commands
<!-- commands -->
* [`sfp init`](#sfp-init-caller-mode)
* [`sfp org`](#sfp-org)
* [`sfp package`](#sfp-package)
* [`sfp sync`](#sfp-sync)
* [`sfp work`](#sfp-work)



## `sfp init`

Intializes the project settings:
* Default branch
* DevHub
* Repo provider

**Needs to be run at least once per project, as other commands depend on the project settings.**

```
USAGE
  $ sfp init
```

_See code: [src/commands/init.ts](https://github.com/dxatscale/sfp-cli/blob/v0.0.38/src/commands/init.ts)_

## `sfp org`

Guided workflows for working with developer orgs, such as opening, creating and deleting an org.

```
USAGE
  $ sfp org
```

_See code: [src/commands/org.ts](https://github.com/dxatscale/sfp-cli/blob/v0.0.38/src/commands/org.ts)_

## `sfp package`

Helpful utilities for dealing with packages in your project:
* Managing package versions and dependency versions
* Create a new package

```
USAGE
  $ sfp package
```

_See code: [src/commands/package.ts](https://github.com/dxatscale/sfp-cli/blob/v0.0.38/src/commands/package.ts)_

## `sfp sync`

Sync changes effortlessly between source repository and development environment

```
USAGE
  $ sfp sync
```

_See code: [src/commands/sync.ts](https://github.com/dxatscale/sfp-cli/blob/v0.0.38/src/commands/sync.ts)_

## `sfp work`

Operations for working with work items:
* Create a new work item
* Switch to an existing work item
* Submit a work item
* Delete a work item

```
USAGE
  $ sfp work
```

_See code: [src/commands/work.ts](https://github.com/dxatscale/sfp-cli/blob/v0.0.38/src/commands/work.ts)_
<!-- commandsstop -->
