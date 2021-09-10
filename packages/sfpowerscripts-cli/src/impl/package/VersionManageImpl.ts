import inquirer = require("inquirer");
import fs = require("fs");
import Version from "@dxatscale/sfpowerscripts.core/lib/package/Version";
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig"

export default class VersionManageImpl {


    protected projectConfig;
    protected packageFlag;
    protected packages;
    protected allPackages;
    protected dependents;
    protected version;
    protected noPrompt;
    protected resetBuildNumber;

    /**
     * 
     * @param projectConfig 
     * @param allpackages 
     * @param dependents 
     * @param packageFlag 
     */
    constructor(projectConfig, allpackages, dependents, packageFlag, version, noprompt, resetbuildnumber) {

        this.projectConfig = projectConfig;
        this.packageFlag = packageFlag;
        this.allPackages = allpackages;
        this.packages = projectConfig.packageDirectories;
        this.dependents = dependents;
        this.version = version;
        this.noPrompt = noprompt;
        this.resetBuildNumber = resetbuildnumber;
    }

    public async execute(): Promise<any> {

        let updatedPackages = new Map();

        if (this.allPackages) {
            updatedPackages = await this.updateAllWithInquirer();
        }
        else if (this.packageFlag != null) {
            updatedPackages = await this.updatePackage();
            if(updatedPackages.size == 0){
                console.log(`No packages with the name ${this.packageFlag} were found.`)
                process.exit(1);
            }
        }
        else {
            console.log('This command must be run with the --package flag or the --allpackages flag')
            process.exit(1);
        }
        console.log(`\nThe following packages will be updated in your sfdx-project.json file`);
        for (let pkg of this.packages) {
            if (updatedPackages.has(pkg.package)) {
                console.log(`Package: ${pkg.package} Version Number: ${pkg.versionNumber}`);
            }
        }
        await this.writeConfig();
    }
    /**
  * prompt the user for the custom number when selected. Verifies the custom number is valid
  * @returns the customVersion if valid
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


    private async updatePackage() {
        let updatedPackages = new Map();
        for (let pkg of this.packages) {
            if (pkg.package == this.packageFlag) {
                let packagePrompt;
                if (this.version != null) {
                    pkg.versionNumber = Version.update(this.version, pkg, this.resetBuildNumber);
                    updatedPackages.set(pkg.package, pkg.versionNumber);
                } else {
                    packagePrompt = await this.packagePrompt(pkg);
                    if (packagePrompt == "skip") {
                        console.log(`Skipped updating package version for ${pkg.package}`)
                    }
                    else if (packagePrompt == "custom") {
                        pkg.versionNumber = await this.getCustom();
                        updatedPackages.set(pkg.package, pkg.versionNumber);
                    } else {
                        updatedPackages.set(pkg.package, pkg.versionNumber);
                    }
                }
                if (this.dependents && packagePrompt != 'skip') {
                    let dependentPkgs = ProjectConfig.getDependents(pkg.package, this.projectConfig);
                    if (dependentPkgs.length != 0) {
                        dependentPkgs.forEach(dependent => {
                            ProjectConfig.updateDependent(pkg, dependent);
                        });
                    }
                } else if (packagePrompt != 'skip') {
                    await this.dependentPrompt(pkg);
                }

            }
        }
        return updatedPackages;
    }


    /**
     * Iterate through all packages to ask the user what it would like to update
     * @param projectConfig 
     */
    private async updateAllWithInquirer() {
        let updatedPackages = new Map();
        for (let pkg of this.packages) {
            let packagePrompt = await this.packagePrompt(pkg);
            if (packagePrompt == "skip") {
                console.log(`Skipped updating package version for ${pkg.package}`)
            }
            else if (packagePrompt == "custom") {
                pkg.versionNumber = await this.getCustom();
                updatedPackages.set(pkg.package, pkg.versionNumber);
            } else {
                updatedPackages.set(pkg.package, pkg.versionNumber);
            }

            if (this.dependents && packagePrompt != 'skip') {
                let dependentPkgs = ProjectConfig.getDependents(pkg.package, this.projectConfig);
                if (dependentPkgs.length != 0) {
                    dependentPkgs.forEach(dependent => {
                        ProjectConfig.updateDependent(pkg, dependent);
                    });
                }
            } else if (packagePrompt != 'skip') {
                await this.dependentPrompt(pkg);
            }
        }
        return updatedPackages;
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
                pkg.versionNumber = Version.update('major', pkg, this.resetBuildNumber);
            }
            else if (selection.selection == 'Minor: ' + newMinor) {
                pkg.versionNumber = Version.update('minor', pkg, this.resetBuildNumber);
            }
            else if (selection.selection == 'Patch: ' + patch) {
                pkg.versionNumber = Version.update('patch', pkg, this.resetBuildNumber);
            }
        });
        if (skip == true) {
            return 'skip'
        }
        if (custom == true) { return 'custom' }
    }

    /**
     * Write the updated config to the sfdx-project.json file
     */
    private async writeConfig() {
        let projectString = JSON.stringify(this.projectConfig, null, 4);
        if (this.noPrompt) {
            console.log('Updating sfdx-project.json');
            fs.writeFileSync('sfdx-project.json', projectString, 'utf-8');
        }
        else {
            await inquirer.prompt([{ type: 'list', name: 'selection', message: `Would you like to write these package updates to the sfdx-project.json?`, choices: ['Yes, Update', 'No, Quit'] }]).then((answer) => {
                if (answer.selection == 'Yes, Update') {
                    console.log('Updating sfdx-project.json')
                    fs.writeFileSync('sfdx-project.json', projectString, 'utf-8');
                } else {
                    console.log('Exiting command')
                    process.exit(1);
                }
            });
        }

    }


    /**
     * Prompt the user on whether or not to update dependent packages
     * @param pkg 
     * @param projectConfig 
     */
    private async dependentPrompt(pkg) {
        await inquirer.prompt([{ type: 'list', name: 'selection', message: `Would you like to update packages that are dependent on ${pkg.package}?`, choices: ['Yes', 'No'] }]).then((answer) => {
            if (answer.selection == 'Yes') {
                let dependentPkgs = ProjectConfig.getDependents(pkg.package, this.projectConfig);
                if (dependentPkgs.length != 0) {
                    dependentPkgs.forEach(dependent => {
                        ProjectConfig.updateDependent(pkg, dependent);
                    });

                }
            }
        });

    }
}