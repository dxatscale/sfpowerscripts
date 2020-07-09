# sfdx-node

[![CircleCI](https://circleci.com/gh/pony-ci/sfdx-node.svg?style=svg)](https://circleci.com/gh/pony-ci/sfdx-node)
[![npm](https://badge.fury.io/js/%40pony-ci%2Fsfdx-node.svg)](https://badge.fury.io/js/%40pony-ci%2Fsfdx-node)
[![License](https://img.shields.io/apm/l/atomic-design-ui.svg?)](https://github.com/pony-ci/sfdx-node/blob/master/LICENSE)

Execute sfdx commands in node.  
The sfdx-cli itself doesn't have to be installed.

## Usage
All commands are asynchronous.
```javascript
// run tests
await sfdx.force.apex.test.run({targetusername: 'username'});

// set default username
await sfdx.force.config.set({}, 'defaultusername=username');

// set global default username
await sfdx.force.config.set({global: true}, 'defaultusername=username');

// suppress stdout and stderr
await sfdx.force.config.set({quiet: true}, 'defaultusername=username');
```

## SFDX Plugins
This module includes the `force` plugin by default.
You can override this plugin with a different version or even add support for other plugins.
To add or override plugin, add node module containing the commands into dependencies in your `package.json` file.
Then register the commands using `registerNamespace` function.
```javascript
// override force plugin
const FORCE_PATH = path.dirname(require.resolve('salesforce-alm'));
registerNamespace({
    commandsDir: path.join(FORCE_PATH, 'commands'),
    namespace: 'force'
});

// add custom plugin
const PLUGIN_PATH = path.dirname(require.resolve('my-plugin-module'));
registerNamespace({
    commandsDir: path.join(PLUGIN_PATH, 'commands'),
    namespace: 'namespace'
});
``` 

Requirements for plugins.
* Commands must be in the `<commandsDir>/<namespace>/` directory.  
* Each command file must contain one of the following:  
    * default export of a class extending `SfdxCommand`
    * export of a class extending the ToolbeltCommand and its name must be in camel case, 
    without namespace name and with `Command` suffix,
    e.g. `OrgCreateCommand` for `force/org/create.js` file where `force` is a namespace.  

Even some first versions of force commands don't fulfil these requirements.  

## License
This software is released under the [MIT License](https://github.com/pony-ci/sfdx-node/blob/master/LICENSE).
