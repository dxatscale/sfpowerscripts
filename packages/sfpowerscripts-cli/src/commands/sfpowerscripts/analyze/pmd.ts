import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../../SfpowerscriptsCommand';
import { Messages, SfdxError } from '@salesforce/core';
import AnalyzeWithPMDImpl from '@dxatscale/sfpowerscripts.core/lib/sfpowerkitwrappers/AnalyzeWithPMDImpl';
import xml2js = require('xml2js');
import {isNullOrUndefined} from 'util';
const fs = require('fs-extra');
const path = require('path');
import * as rimraf from "rimraf";
const Table = require("cli-table");

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'analyze_with_PMD');

export default class AnalyzeWithPMD extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:analyze:pmd -b\n`,
    `Output variable:`,
    `sfpowerscripts_pmd_output_path`,
    `<refname>_sfpowerscripts_pmd_output_path`
  ];

  protected static requiresProject = true;
  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;
  protected static flagsConfig = {
  sourcedir: flags.string({
    description: messages.getMessage("sourceDirectoryFlagDescription"),
  }),
  ruleset: flags.string({
    description: messages.getMessage("rulesetFlagDescription"),
    options: ["sfpowerkit", "Custom"],
    default: "sfpowerkit",
  }),
  rulesetpath: flags.string({
    description: messages.getMessage("rulesetPathFlagDescription"),
  }),
  format: flags.string({
    description: messages.getMessage("formatFlagDescription"),
    options: [
      "text",
      "textcolor",
      "csv",
      "emacs",
      "summaryhtml",
      "html",
      "xml",
      "xslt",
      "yahtml",
      "vbhtml",
      "textpad",
      "sarif",
    ],
    default: "text",
  }),
  outputpath: flags.string({
    char: "o",
    description: messages.getMessage("outputPathFlagDescription"),
  }),
  version: flags.string({
    required: false,
    default: "6.34.0",
    description: messages.getMessage("versionFlagDescription"),
  }),
  istobreakbuild: flags.boolean({
    char: "b",
    deprecated: {
      messageOverride:
        "--istobreakbuild has been deprecated, the command will always break if there is critical errors",
    },
    description: messages.getMessage("isToBreakBuildFlagDescription"),
  }),
  refname: flags.string({
    description: messages.getMessage("refNameFlagDescription"),
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
  }),
};

  public async execute(){
    try {

      
     // Setup Logging Directory
     rimraf.sync("sfpowerscripts");
     fs.mkdirpSync(".sfpowerscripts");



      const source_directory: string = this.flags.sourcedir;
      const ruleset: string = this.flags.ruleset;


      let rulesetpath=""
      if (ruleset == "Custom") {
        let rulesetpath = this.flags.rulesetpath;
        console.log(rulesetpath);
      }



      const format: string = this.flags.format;
      const outputPath: string = this.flags.outputpath;
      const version: string = this.flags.version;

      const isToBreakBuild = this.flags.istobreakbuild;

      let result: [number, number, number] = [0, 0, 0];

      let pmdImpl: AnalyzeWithPMDImpl;
  
      
      let artifactFilePath = path.join(".sfpowerscripts","sf-pmd-output.xml");
      pmdImpl = new AnalyzeWithPMDImpl(
        source_directory,
        rulesetpath,
        "xml",
        artifactFilePath,
        version
      );

      await pmdImpl.exec(false);
      

      if (fs.existsSync(artifactFilePath)) {
      result = parseXmlReport(artifactFilePath);
      }



      //If the user has requested for an output path, do one more pass
      if(outputPath)
      {
        pmdImpl = new AnalyzeWithPMDImpl(
        source_directory,
        rulesetpath,
        format,
        outputPath,
        version
      );
      
      await pmdImpl.exec(false);
      }


      if (!isNullOrUndefined(this.flags.refname)) {
        if (!isNullOrUndefined(outputPath)) {
            fs.writeFileSync('.env', `${this.flags.refname}_sfpowerscripts_pmd_output_path=${outputPath}\n`, {flag:'a'});
        } else {
            fs.writeFileSync('.env', `${this.flags.refname}_sfpowerscripts_pmd_output_path=${process.env.PWD}/pmd-output\n`, {flag:'a'});
        }
      } else {
        if (!isNullOrUndefined(outputPath)) {
          fs.writeFileSync('.env', `sfpowerscripts_pmd_output_path=${outputPath}\n`, {flag:'a'});
        } else {
          fs.writeFileSync('.env', `sfpowerscripts_pmd_output_path=${process.env.PWD}/pmd-output\n`, {flag:'a'});
        }
      }

      if (isToBreakBuild && result[2] > 0)
          throw new SfdxError(`Build Failed due to ${result[2]} critical defects found`);

    } catch (err) {
      console.log(err);
      // Fail the task when an error occurs
      process.exit(1);
    }

    function parseXmlReport(xmlReport: string): [number, number, number] {
      let fileCount = 0;
      let violationCount = 0;
      let criticaldefects = 0;

  

      let reportContent: string = fs.readFileSync(xmlReport, "utf-8");
      xml2js.parseString(reportContent, (err, data) => {
        // If the file is not XML, or is not from PMD, return immediately
        if (!data || !data.pmd) {
          console.debug(`Empty or unrecognized PMD xml report ${xmlReport}`);
          return null;
        }

        if (!data.pmd.file || data.pmd.file.length === 0) {
          // No files with violations, return now that it has been marked for upload
          return null;
        }

        data.pmd.file.forEach((file: any) => {
          if (file.violation) {
            fileCount++;
            violationCount += file.violation.length;
          }
        });

        for (let i = 0; i < data.pmd.file.length; i++) {
          console.log(`${data.pmd.file[i]["$"].name}`);
          let table = new Table({
            head: ["Priority","Line Number", "Rule", "Description"],
          });
      
          data.pmd.file[i].violation.forEach(element => {
           table.push(element["$"]["priority"],[element["$"].beginline, element["$"].rule , element._.trim()]);
            if (element["$"]["priority"] == 1) {
              criticaldefects++;
            }
          });
          console.log(table.toString());
        }
      });

      return [violationCount, fileCount, criticaldefects];
    }
  }
}