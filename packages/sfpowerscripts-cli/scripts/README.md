## Exporting output variables from the environment file

Output variables are written to an environment file `.env` in a `key=value` format. These variables can be made available at the shell layer using the `readVars.sh` helper script, which will read the `.env` file and export the variables to the environment.

### Installation

One method of making the helper script globally invocable, is to install the NPM module as follows:

```
  $ npm install -g @dxatscale/sfpowerscripts
```

The script is then invocable as `source readVars` from the command-line, which will make the variables available in the current environment.

If you're using a Docker image as part of your build process, you could also `COPY` the script into the image and link it to `$PATH`.

### Usage example

```
$ sfdx sfpowerscripts:CreateDeltaPackage -n mypackage -r 61635fb -t 3cf01b9 -v 1.2.10 -b
$ source readVars

Do something with ${sfpowerscripts_delta_package_path}...

$ sfdx sfpowerscripts:DeploySource -u scratchorg --sourcedir ${sfpowerscripts_delta_package_path} -c
```
