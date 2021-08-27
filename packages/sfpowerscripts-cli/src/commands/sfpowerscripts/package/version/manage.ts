import { Messages } from "@salesforce/core";
import SfpowerscriptsCommand from '../../../../SfpowerscriptsCommand';
import { flags } from '@salesforce/command';
import fs = require("fs");
import inquirer = require("inquirer");
import semver = require("semver");


// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'manage_versions');

export default class ManageVersions extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `sfdx sfpowerscripts:package:version:manage`
  ];

  protected static flagsConfig = {
    dependencies: flags.boolean({
      required: false,
      default: false,
      char: "d",
      description: messages.getMessage("dependenciesDescription"),
    }),
    allpackages: flags.boolean({
      required: false,
      default: false,
      char: "p",
      description: messages.getMessage("allPackagesDescription"),
    }),
    version: flags.enum({
      required: false,
      char: "v",
      description: messages.getMessage("versionDescription"),
      options: [
        "major",
        "minor",
        "patch",
      ]
    }),
    loglevel: flags.enum({
      description: "logging level for this command invocation",
      default: "info",
      required: false,
      options: [
        "trace",
        "debug",
        "info",
        "warn",
        "error",
        "fatal",
        "TRACE",
        "DEBUG",
        "INFO",
        "WARN",
        "ERROR",
        "FATAL",
      ],
    })
  };

  protected static requiresProject = true;
  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  public async execute() {
    try {
      const projectConfig = JSON.parse(
        fs.readFileSync("sfdx-project.json", "utf8")
      );

      /**
       * TODO: Custom numbering 
       * SEMVER library 
       * Flag for build number
       * Greenfield project
       * Confirmation of updates
       * 
       * Separating into modular functions in core library 
       */


      let packages = projectConfig.packageDirectories;
      let dependencyMap = new Map();

      if (this.flags.allpackages && this.flags.version != null) {
        dependencyMap = this.increaseAll(packages);

      } else {
        //First iteration of packages to update version numbers 
        for (let pkg of packages) {
          console.log(`${pkg.package} version number: ${pkg.versionNumber}`)
          let newMajor = this.getMajor(pkg.versionNumber);
          let newMinor = this.getMinor(pkg.versionNumber);
          let patch = this.getPatch(pkg.versionNumber);
          let custom = false;

          let skip = false;
          await inquirer.prompt([{ type: 'list', name: 'selection', message: `Would you like to update ${pkg.package}?`, choices: ['Major: ' + newMajor, 'Minor: ' + newMinor, 'Patch: ' + patch, 'Custom', 'Skip'] }]).then((selection) => {
            if (selection.selection == 'Skip') {
              skip = true;
            } else if (selection.selection == 'Custom') {
              custom = true;
            } else if (selection.selection == `'Major: ' + ${newMajor}`) {
              pkg.versionNumber = this.updateVersion('major', pkg)
            } else if (selection.selection == `'Minor: ' + ${newMinor}`) {
              pkg.versionNumber = this.updateVersion('minor', pkg)
            } else if (selection.selection == `'Patch: ' + ${patch}`) {
              pkg.versionNumber = this.updateVersion('patch', pkg)
            }

          });

          if (custom) {
            pkg.versonNumber = await this.getCustom();

          }


          if (!skip) {
            if (this.hasNonZeroBuildNo(pkg.versionNumber)) {
              await inquirer.prompt([{ type: 'list', name: 'selection', message: `Would you like the build number for ${pkg.package} reset to 0?`, choices: ['Yes', 'No'] }]).then((answer) => {
                if (answer.selection == 'Yes') { pkg.versionNumber = this.resetBuildNumber(pkg.versionNumber); }
                console.log(pkg.versionNumber);
              });
            }

            if (!this.flags.dependencies) {
              await inquirer.prompt([{ type: 'list', name: 'selection', message: `Would you like to update dependency version for all packages that have ${pkg.package} as a dependency?`, choices: ['Yes', 'No'] }]).then((answer) => {
                if (answer.selection == 'Yes') {
                  dependencyMap.set(pkg.package, pkg.versionNumber);
                }
              });
            } else {
              dependencyMap.set(pkg.package, pkg.versionNumber);
            }
          }
        }
      }



      //update project config with 
      projectConfig.packageDirectories = packages;
      packages = projectConfig.packageDirectories;

      projectConfig.packageDirectories = this.updateDependencies(dependencyMap, packages);

      let projectString = JSON.stringify(projectConfig, null, 4);

      fs.writeFileSync('sfdx-project.json', projectString, 'utf-8');

    }
    catch (err) {
      console.log(err);
      process.exit(1);
    }
  }

  private getMajor(currentVersion) {
    let verArr = currentVersion.split('.');
    currentVersion = verArr.splice(0, 3);

    let major = semver.inc(currentVersion.join('.'), 'major');
    major = major + '.' + verArr;
    return major;
  }
  private getMinor(currentVersion) {
    let verArr = currentVersion.split('.');
    currentVersion = verArr.splice(0, 3);
    let minor = semver.inc(currentVersion.join('.'), 'minor') + '.' + verArr;
    return minor;
  }
  private getPatch(currentVersion) {
    let verArr = currentVersion.split('.');
    currentVersion = verArr.splice(0, 3);
    let patch = semver.inc(currentVersion.join('.'), 'patch') + '.' + verArr;
    return patch;
  }
  private getBuildNumber(currentVersion) {
    let verArr = currentVersion.split('.');
    return verArr[3];
  }
  private hasNonZeroBuildNo(currentVersion) {
    if (!(currentVersion.includes('NEXT') || currentVersion.includes('LATEST'))) {
      if (this.getBuildNumber(currentVersion) != '0') {
        return true;
      } else {
        return false;
      }
    }
    return false;
  }

  private updateVersion(selection, pkg) {
    if (selection == 'skip') {
      return;
    }
    if (selection == 'major') {
      pkg.versionNumber = this.getMajor(pkg.versionNumber);
    } else if (selection == 'minor') {
      pkg.versionNumber = this.getMinor(pkg.versionNumber);
    } else if (selection == 'patch') {
      pkg.versionNumber = this.getPatch(pkg.versionNumber);
    }
    else if (selection == 'Custom') {
      //write for custom
    }
    console.log(`${pkg.package} version will be updated to ${pkg.versionNumber}\n`);
    return pkg.versionNumber;
  }

  private resetBuildNumber(currentVersion) {
    let versionArr = currentVersion.split('.');
    versionArr[3] = '0';
    return versionArr.join('.');
  }

  private increaseAll(packages) {
    let dependencyMap = new Map();
    for (let pkg of packages) {
      this.updateVersion(this.flags.version, pkg)
      dependencyMap.set(pkg.package, pkg.versionNumber);
    }
    return dependencyMap;
  }

  private updateDependencies(dependencies, packages) {
    for (let pkg of packages) {
      if (pkg.dependencies != null) {
        for (let dependency of pkg.dependencies) {
          if (dependencies.has(dependency.package)) {
            let versionNumber = dependencies.get(dependency.package).split('.');
            if (versionNumber[3] == 'NEXT') { versionNumber[3] = 'LATEST'; }
            dependency.versionNumber = versionNumber.join('.');
          }
        }
      }
    }
    return packages;
  }

  private async getCustom() {
    let custom;
    await inquirer.prompt([{ type: 'input', name: 'selection', message: `Input custom versionNumber` }]).then((answers) => { custom = answers.selection; });

    custom = this.verifyCustom(custom)
    if (custom == false) {
      console.log(`Custom number was invalid`);
      return this.getCustom();
    }else{
      return custom;
    }
  }

  private verifyCustom(versionNumber) {
    let verArray = versionNumber.split('.');
    let validated = semver.valid(verArray.splice(0, 3).join('.'));
    console.log(validated);
    if (validated != null && (!isNaN(verArray) || verArray == "NEXT")) {
      return versionNumber;
    } else {
      return false;
    }
  }

}