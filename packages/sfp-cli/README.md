sfp-cli
=======

PRE-ALPHA Developer CLI for Salesforce programs following the DX@Scale model

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/@dxatscale/sfp-cli.svg)](https://npmjs.org/package/@dxatscale/sfp-cli)
[![Downloads/week](https://img.shields.io/npm/dw/@dxatscale/sfp-cli.svg)](https://npmjs.org/package/@dxatscale/sfp-cli)
[![License](https://img.shields.io/npm/l/@dxatscale/sfp-cli.svg)](https://github.com/dxatscale/sfp-cli/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @dxatscale/sfp-cli
$ sfp COMMAND
running command...
$ sfp (-v|--version|version)
@dxatscale/sfp-cli/0.0.38 darwin-x64 node-v16.13.1
$ sfp --help [COMMAND]
USAGE
  $ sfp COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`sfp help [COMMAND]`](#sfp-help-command)
* [`sfp init [CALLER] [MODE]`](#sfp-init-caller-mode)
* [`sfp org`](#sfp-org)
* [`sfp package`](#sfp-package)
* [`sfp sync`](#sfp-sync)
* [`sfp work`](#sfp-work)

## `sfp help [COMMAND]`

display help for sfp

```
USAGE
  $ sfp help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.2.3/src/commands/help.ts)_

## `sfp init [CALLER] [MODE]`

intializes the project with various defaults

```
USAGE
  $ sfp init [CALLER] [MODE]

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/init.ts](https://github.com/dxatscale/sfp-cli/blob/v0.0.38/src/commands/init.ts)_

## `sfp org`

guided workflows to help with developer orgs

```
USAGE
  $ sfp org

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/org.ts](https://github.com/dxatscale/sfp-cli/blob/v0.0.38/src/commands/org.ts)_

## `sfp package`

helpers to deal with packages in your project

```
USAGE
  $ sfp package

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/package.ts](https://github.com/dxatscale/sfp-cli/blob/v0.0.38/src/commands/package.ts)_

## `sfp sync`

sync changes effortlessly either with repository or development environment

```
USAGE
  $ sfp sync

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/sync.ts](https://github.com/dxatscale/sfp-cli/blob/v0.0.38/src/commands/sync.ts)_

## `sfp work`

create/switch/submit a workitem

```
USAGE
  $ sfp work

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/work.ts](https://github.com/dxatscale/sfp-cli/blob/v0.0.38/src/commands/work.ts)_
<!-- commandsstop -->
