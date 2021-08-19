import { Messages } from "@salesforce/core";
import SfpowerscriptsCommand from '../../../../SfpowerscriptsCommand';
import { flags } from '@salesforce/command';
import fs = require("fs");
import inquirer = require("inquirer");
import { captureRejectionSymbol } from "events";

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'manage_versions');

export default class ManageVersions extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `sfdx sfdxpowerscripts:package:version:manage`
  ];

  protected static flagsConfig = {
    
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

  public async execute(){
    try {
      const projectConfig = JSON.parse(
        fs.readFileSync("sfdx-project.json", "utf8")
      );
      
      let packages = projectConfig.packageDirectories; 
      console.log(`The sfdx-project.json contains the packages and dependencies:\n`);
      for(let pkg of packages){
        console.log(`${pkg.package} version number: ${pkg.versionNumber}`)
        let newMajor = this.getMajor(pkg.versionNumber);
        let newMinor = this.getMinor(pkg.versionNumber);
        let patch = this.getPatch(pkg.versionNumber)
       
        
        await inquirer.prompt([{type: 'list', name: 'selection', message: `Would you like to update ${pkg.package}?`, choices: ['Major: ' + newMajor, 'Minor: ' + newMinor, 'Patch: ' + patch, 'Custom', 'Skip']}]).then((selection) => {
          pkg.versionNumber = this.updateVersion(selection.selection, pkg)
        });

        if(this.hasNonZeroBuildNo(pkg.versionNumber)){
          await inquirer.prompt([{type: 'list', name: 'selection', message: `Would you like the build number for ${pkg.package} reset to 0?`, choices: ['Yes', 'No']}]).then((answer) => {
            if(answer.selection == 'Yes'){pkg.versionNumber = this.resetBuildNumber(pkg.versionNumber);}
            console.log(pkg.versionNumber);
          });
        }
      
      }
      projectConfig.packageDirectories = packages;
      let projectString = JSON.stringify(projectConfig,null,4);

      fs.writeFileSync('sfdx-project.json', projectString, 'utf-8')

    }
    catch (err){
      console.log(err);
      process.exit(1);
    }
  }

  private getMajor(currentVersion){
    let verArr = currentVersion.split('.');
    verArr[0]++;
    return verArr.join('.');
  }
  private getMinor(currentVersion){
    let verArr = currentVersion.split('.');
    verArr[1]++;
    return verArr.join('.');
  }
  private getPatch(currentVersion){
    let verArr = currentVersion.split('.');
    verArr[2]++;
    return verArr.join('.');
  }
  private getBuildNumber(currentVersion){
    let verArr = currentVersion.split('.');
    return verArr[3];
  }
  private hasNonZeroBuildNo(currentVersion){
    if(!(currentVersion.includes('NEXT') || currentVersion.includes('LATEST'))){
      if(this.getBuildNumber(currentVersion) != '0'){
        return true;
      }else{
        return false; 
      }
    }
    return false;
  }

  private updateVersion(selection, pkg) {
    if(selection == 'skip'){
      return; 
    }
    if(selection == 'Major: ' + this.getMajor(pkg.versionNumber)){
      pkg.versionNumber = this.getMajor(pkg.versionNumber);
    }else if(selection == 'Minor: '+ this.getMinor(pkg.versionNumber)){
      pkg.versionNumber = this.getMinor(pkg.versionNumber);
    }else if(selection == 'Patch: '+ this.getPatch(pkg.versionNumber)){
      pkg.versionNumber = this.getPatch(pkg.versionNumber);
    }
    else if(selection == 'Custom'){
      //write for custom
    }
    console.log(`${pkg.package} version will be updated to ${pkg.versionNumber}\n`);
    return pkg.versionNumber;
  }

  private resetBuildNumber(currentVersion){
    let versionArr = currentVersion.split('.');
    versionArr[3] = '0';
    return versionArr.join('.'); 
  }
}