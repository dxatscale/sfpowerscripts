import { Messages } from "@salesforce/core";
import SfpowerscriptsCommand from '../../../../SfpowerscriptsCommand';
import { flags } from '@salesforce/command';
import fs = require("fs");
import inquirer = require("inquirer");
import semver = require("semver");
import Version from "@dxatscale/sfpowerscripts.core/lib/package/Version";
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig"

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'manage_versions');

export default class Manage extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `sfdx sfpowerscripts:package:version:manage`
  ];

  protected static flagsConfig = {
    dependents: flags.boolean({
      required: false,
      default: false,
      char: "d",
      description: messages.getMessage("dependenciesDescription"),
    }),
    package: flags.string({
      required: false,
      char: 'p',
      description: messages.getMessage('packageDescription')
    }),
    allpackages: flags.boolean({
      required: false,
      default: false,
      char: "a",
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


  //TODO: no prompt 
  //TODO: specific package - done, function in ProjectConfig class
  //TODO: 
  //TODO: Diff version - Talk alan 
  //TODO: New class, dependent finder (list all dependents of a pcakage) - done, function in ProjectConfig Class

  /**
   * input a package: (parameter as a flag)
   * If patch, minor - skip updating dependencies 
   * If major, ask if dependencies need to be updated 
   * Spit out list of dependents which were updated.
   * Eg. The following packages were updated:: 
   * 
   */



  protected static requiresProject = true;
  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  public async execute() {
    try {
      const projectConfig = JSON.parse(
        fs.readFileSync("sfdx-project.json", "utf8")
      );
      let packages = projectConfig.packageDirectories;



      let version = new Version();
      let dependencyMap = new Map();
      let updatedPackages = new Map();

      if (this.flags.allpackages) {
        await this.updateAllWithInquirer(projectConfig);

      } else {

        //First iteration of packages to update version numbers 
        for (let pkg of packages) {
          console.log(`${pkg.package} version number: ${pkg.versionNumber}`)
          let custom = false;
          let skip = false;
          await this.packagePrompt(pkg);

          if (custom) {
            pkg.versonNumber = await this.getCustom();
          }


          if (!skip) {
            if (version.hasNonZeroBuildNo(pkg.versionNumber)) {
              await inquirer.prompt([{ type: 'list', name: 'selection', message: `Would you like the build number for ${pkg.package} reset to 0?`, choices: ['Yes', 'No'] }]).then((answer) => {
                if (answer.selection == 'Yes') { pkg.versionNumber = version.resetBuildNumber(pkg.versionNumber); }
              });
            }
            updatedPackages.set(pkg.package, pkg.versionNumber);


            if (!this.flags.dependencies) {
              await inquirer.prompt([{ type: 'list', name: 'selection', message: `Would you like to update packages that are dependent on ${pkg.package}?`, choices: ['Yes', 'No'] }]).then((answer) => {
                if (answer.selection == 'Yes') {
                  let dependentPkgs = ProjectConfig.getDependents(pkg, projectConfig);
                  if (dependentPkgs.length != 0) {
                    dependentPkgs.forEach(dependent => {
                      dependent = ProjectConfig.updateDependent(pkg, dependent);
                    });

                  }
                }
              });
            } else {
              let dependentPkgs = ProjectConfig.getDependents(pkg, projectConfig);
              if (dependentPkgs.length != 0) {
                dependentPkgs.forEach(dependent => {
                  ProjectConfig.updateDependent(pkg, dependent);
                });
              }
            }
          }


        }
      }
      console.log(`The following packages and dependencies will be updated in your sfdx-project.json file`);
      for (let pkg of packages) {
        if (updatedPackages.has(pkg.package)) {
          console.log(`Package: ${pkg.package} Version Number: ${pkg.versionNumber}`);
          if (dependencyMap.has(pkg.package)) {
            console.log(`All packages with ${pkg.package} as a dependency will also be updated\n`);
          } else {
            console.log(`No packages with ${pkg.package} as a dependency will be updated\n`)
          }
        }
      }
      await inquirer.prompt([{ type: 'list', name: 'selection', message: `Would you like to write these package updates to the sfdx-project.json?`, choices: ['Yes, Update', 'No, Quit'] }]).then((answer) => {
        if (answer.selection == 'Yes, Update') {
          console.log('Updating sfdx-project.json')
          let projectString = JSON.stringify(projectConfig, null, 4);
          fs.writeFileSync('sfdx-project.json', projectString, 'utf-8');
        } else {
          console.log('Exiting command')
          process.exit(1);
        }
      });
    }
    catch (err) {
      console.log(err);
      process.exit(1);
    }
  }

  /**
   * prompt the user for the custom number when selected
   * @returns 
   */
  private async getCustom() {
    let customVersion;
    await inquirer.prompt([{ type: 'input', name: 'selection', message: `Input custom versionNumber` }]).then((answers) => { customVersion = answers.selection; });
    customVersion = Version.verifyCustom(customVersion)

    if (!customVersion) {
      console.log(`Custom number was invalid`);
      return this.getCustom();
    } else {
      return customVersion;
    }
  }

  /**
   * Update a specific package inputted by the user with --package packagename flag 
   * @param projectConfig 
   */
  private updatePackage(projectConfig) {
    let packages = projectConfig.packageDirectories;

  }


  /**
   * Iterate through all packages to ask the user what it would like to update
   * @param projectConfig 
   */
  private async updateAllWithInquirer(projectConfig) {
    let packages = projectConfig.packageDirectories;
    for (let pkg of packages) {
      let packagePrompt = await this.packagePrompt(pkg);
      if (packagePrompt == "skip") {
        console.log(`Skipped updating package version for ${pkg.package}`)
      }
      else if (packagePrompt == "custom") {
        await this.getCustom();
      } else {

        if (this.flags.dependents) {
          let dependentPkgs = ProjectConfig.getDependents(pkg.package, projectConfig);
          if (dependentPkgs.length != 0) {
            dependentPkgs.forEach(dependent => {
              dependent = ProjectConfig.updateDependent(pkg, dependent);
            });
          }
        } else {
          await this.dependentPrompt(pkg, projectConfig);
        }
      }
    }
  }

  /**
   * Prompt using inquirier for the version of the given package to update
   * @param pkg 
   * @returns 
   */
  private async packagePrompt(pkg) {
    let newMajor = Version.getMajor(pkg.versionNumber);
    let newMinor = Version.getMinor(pkg.versionNumber);
    let patch = Version.getPatch(pkg.versionNumber);
    let skip;
    let custom;

    await inquirer.prompt([{ type: 'list', name: 'selection', message: `Would you like to update ${pkg.package}?`, choices: ['Major: ' + newMajor, 'Minor: ' + newMinor, 'Patch: ' + patch, 'Custom', 'Skip'] }]).then((selection) => {

      /**If else statement based on the selection by the user */
      if (selection.selection == 'Skip') {
        return skip = true;
      }
      else if (selection.selection == 'Custom') {
        return custom = true;
      }
      else if (selection.selection == 'Major: ' + newMajor) {
        pkg.versionNumber = Version.update('major', pkg);
      }
      else if (selection.selection == 'Minor: ' + newMinor) {
        pkg.versionNumber = Version.update('minor', pkg);
      }
      else if (selection.selection == 'Patch: ' + patch) {
        pkg.versionNumber = Version.update('patch', pkg);;
      }
    });
    if (skip == true) {
      return 'skip'
    }
    if (custom == true) { return 'custom' }
  }


  /**
   * Get all packages which have been updated
   */
  private getUpdated() { }

  /**
   * Write the updated config to the sfdx-project.json file
   */
  private static writeConfig() { }


  /**
   * Prompt the user on whether or not to update dependent packages
   * @param pkg 
   * @param projectConfig 
   */
  private async dependentPrompt(pkg, projectConfig) {
    await inquirer.prompt([{ type: 'list', name: 'selection', message: `Would you like to update packages that are dependent on ${pkg.package}?`, choices: ['Yes', 'No'] }]).then((answer) => {
      if (answer.selection == 'Yes') {
        let dependentPkgs = ProjectConfig.getDependents(pkg.package, projectConfig);
        if (dependentPkgs.length != 0) {
          dependentPkgs.forEach(dependent => {
            dependent = ProjectConfig.updateDependent(pkg, dependent);
          });

        }
      }
    });

  }

  private updateDependents() { }
}