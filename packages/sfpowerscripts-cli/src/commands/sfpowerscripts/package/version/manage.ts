import { Messages } from "@salesforce/core";
import SfpowerscriptsCommand from '../../../../SfpowerscriptsCommand';
import { flags } from '@salesforce/command';
import fs = require("fs");
import inquirer = require("inquirer");
import semver = require("semver");
import Update from "@dxatscale/sfpowerscripts.core/lib/package/version/Update";


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

      let packages = projectConfig.packageDirectories;


      let versionUpdate = new Update();
      let dependencyMap = new Map();
      let updatedPackages = new Map();

      if (this.flags.allpackages && this.flags.version != null) {
        for (let pkg of packages) {
          versionUpdate = new Update(pkg, this.flags.version);
          pkg.versionNumber = versionUpdate.update()
          updatedPackages.set(pkg.package, pkg.versionNumber);
          dependencyMap.set(pkg.package, pkg.versionNumber);
        }

      } else {
        //First iteration of packages to update version numbers 
        for (let pkg of packages) {
          console.log(`${pkg.package} version number: ${pkg.versionNumber}`)
          let newMajor = versionUpdate.getMajor(pkg.versionNumber);
          let newMinor = versionUpdate.getMinor(pkg.versionNumber);
          let patch = versionUpdate.getPatch(pkg.versionNumber);
          let custom = false;

          let skip = false;
          await inquirer.prompt([{ type: 'list', name: 'selection', message: `Would you like to update ${pkg.package}?`, choices: ['Major: ' + newMajor, 'Minor: ' + newMinor, 'Patch: ' + patch, 'Custom', 'Skip'] }]).then((selection) => {

            /**If else statement based on the selection by the user */
            if (selection.selection == 'Skip') {
              skip = true;
            }
            else if (selection.selection == 'Custom') {
              custom = true;
            }
            else if (selection.selection == 'Major: ' + newMajor) {
              versionUpdate = new Update(pkg, 'major');
              pkg.versionNumber = versionUpdate.update();
            }
            else if (selection.selection == 'Minor: ' + newMinor) {
              versionUpdate = new Update(pkg, 'minor');
              pkg.versionNumber = versionUpdate.update()
            }
            else if (selection.selection == 'Patch: ' + patch) {
              versionUpdate = new Update(pkg, 'patch');
              pkg.versionNumber = versionUpdate.update()
            }
      
          });

          if (custom) {
            pkg.versonNumber = await this.getCustom();

          }


          if (!skip) {
            if (versionUpdate.hasNonZeroBuildNo(pkg.versionNumber)) {
              await inquirer.prompt([{ type: 'list', name: 'selection', message: `Would you like the build number for ${pkg.package} reset to 0?`, choices: ['Yes', 'No'] }]).then((answer) => {
                if (answer.selection == 'Yes') { pkg.versionNumber = versionUpdate.resetBuildNumber(pkg.versionNumber); }
              });
            }
            updatedPackages.set(pkg.package, pkg.versionNumber);


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

      projectConfig.packageDirectories = versionUpdate.updateDependencies(dependencyMap, packages);

      console.log(`The following packages and dependencies will be updated in your sfdx-project.json file`); 
      for(let pkg of packages){
        if(updatedPackages.has(pkg.package)){
          console.log(`Package: ${pkg.package} Version Number: ${pkg.versionNumber}`);
          if(dependencyMap.has(pkg.package)){
            console.log(`All packages with ${pkg.package} as a dependency will also be updated\n`);
          }else{
            console.log(`No packages with ${pkg.package} as a dependency will be updated\n`)
          }
        }
      }
      await inquirer.prompt([{ type: 'list', name: 'selection', message: `Would you like to write these package updates to the sfdx-project.json?`, choices: ['Yes, Update', 'No, Quit'] }]).then((answer) => {
        if (answer.selection == 'Yes, Update') {
          console.log('Updating sfdx-project.json')
          let projectString = JSON.stringify(projectConfig, null, 4);
          fs.writeFileSync('sfdx-project.json', projectString, 'utf-8');
        }else{
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
    customVersion = this.verifyCustom(customVersion)

    if (customVersion == false) {
      console.log(`Custom number was invalid`);
      return this.getCustom();
    } else {
      return customVersion;
    }
  }

  /**
   * 
   * @param versionNumber 
   * @returns 
   */
  private verifyCustom(versionNumber) {
    let verArray = versionNumber.split('.');
    let validated = semver.valid(verArray.splice(0, 3).join('.'));
    if (validated != null && (!isNaN(verArray) || verArray == "NEXT")) {
      return versionNumber;
    } else {
      return false;
    }
  }
}