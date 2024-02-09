import SFPLogger, { COLOR_HEADER, COLOR_KEY_VALUE, COLOR_KEY_MESSAGE, COLOR_TRACE } from "@flxblio/sfp-logger";
import SFPOrg from "../core/org/SFPOrg";
const Table = require("cli-table");
import { LoggerLevel } from "@salesforce/core";
import GroupConsoleLogs from "./GroupConsoleLogs";
import { COLON_MIDDLE_BORDER_TABLE } from "./TableConstants";
import ScratchOrg from "../core/scratchorg/ScratchOrg";
import { Align, getMarkdownTable } from "markdown-table-ts";
import fs from "fs-extra";
import FileOutputHandler from "../outputs/FileOutputHandler";

export default class OrgInfoDisplayer {

  public static printScratchOrgInfo(scratchOrg: ScratchOrg): void {
    let groupSection = new GroupConsoleLogs(`Display Org Info`).begin();

    SFPLogger.printHeaderLine('', COLOR_HEADER, LoggerLevel.INFO);
    SFPLogger.log(COLOR_KEY_VALUE(`-- Org Details:--`));
    const table = new Table({
      chars: COLON_MIDDLE_BORDER_TABLE,
      style: { "padding-left": 2 },
    });
    table.push([COLOR_HEADER(`Org Id`), COLOR_KEY_MESSAGE(scratchOrg.orgId)]);
    table.push([
      COLOR_HEADER(`Login URL`),
      COLOR_KEY_MESSAGE(scratchOrg.loginURL),
    ]);
    table.push([
      COLOR_HEADER(`Username`),
      COLOR_KEY_MESSAGE(scratchOrg.username),
    ]);
    table.push([
      COLOR_HEADER(`Password`),
      COLOR_KEY_MESSAGE(scratchOrg.password),
    ]);
    table.push([
      COLOR_HEADER(`Auth URL`),
      COLOR_KEY_MESSAGE(scratchOrg.sfdxAuthUrl),
    ]);
    table.push([
      COLOR_HEADER(`Expiry`),
      COLOR_KEY_MESSAGE(scratchOrg.expiryDate),
    ]);
    SFPLogger.log(table.toString(), LoggerLevel.INFO);

    SFPLogger.log(
      COLOR_TRACE(
        `You may use the following commands to authenticate to the org`,
      ),
      LoggerLevel.INFO,
    );
    SFPLogger.log(
      COLOR_TRACE(`echo ${scratchOrg.sfdxAuthUrl} > ./authfile`),
      LoggerLevel.INFO,
    );
    SFPLogger.log(
      COLOR_TRACE(`sf org login sfdx-url --sfdx-url-file=authfile`),
      LoggerLevel.INFO,
    );
    SFPLogger.log(
      COLOR_TRACE(`sf org open --target-org=${scratchOrg.username}`),
      LoggerLevel.INFO,
    );

    SFPLogger.printHeaderLine('', COLOR_HEADER, LoggerLevel.INFO);




    groupSection.end();
  }

  public static writeScratchOrgInfoToMarkDown(scratchOrg: ScratchOrg): void {
    const pathToMarkDownFile = `org-info.md`;
    const fileOutputHandler = FileOutputHandler.getInstance();
    fileOutputHandler.writeOutput(pathToMarkDownFile, `\nPlease find the validation org details below`);
    let tableData = {
      table: {
        head: [
          'Org Info',
          '',
        ],
        body: []
      },
      alignment: [Align.Left, Align.Left, Align.Left, Align.Right],
    };
    tableData.table.body.push([`Org Id`, scratchOrg.orgId]);
    tableData.table.body.push([`Login URL`, scratchOrg.loginURL]);
    tableData.table.body.push([`Username`, scratchOrg.username]);
    tableData.table.body.push([`Password`, scratchOrg.password]);
    tableData.table.body.push([`Expiry`, scratchOrg.expiryDate]);
    fileOutputHandler.appendOutput(pathToMarkDownFile, `\n\n${getMarkdownTable(tableData)}`);

    fileOutputHandler.appendOutput(pathToMarkDownFile,
      `\n\nYou may use the following commands to authenticate to the org`,);
    fileOutputHandler.appendOutput(pathToMarkDownFile, `\`\`\``);
    fileOutputHandler.appendOutput(pathToMarkDownFile, `echo ${scratchOrg.sfdxAuthUrl} > ./authfile`);
    fileOutputHandler.appendOutput(pathToMarkDownFile, `sf org login sfdx-url --sfdx-url-file=authfile`);
    fileOutputHandler.appendOutput(pathToMarkDownFile, `sf org open --target-org=${scratchOrg.username}`);
    fileOutputHandler.appendOutput(pathToMarkDownFile, `\`\`\``);

  }

  public static printOrgInfo(org: SFPOrg): void {
    let groupSection = new GroupConsoleLogs(`Display Org Info`).begin();

    SFPLogger.printHeaderLine('', COLOR_HEADER, LoggerLevel.INFO);
    SFPLogger.log(COLOR_KEY_VALUE(`-- Org Details:--`));
    const table = new Table({
      chars: COLON_MIDDLE_BORDER_TABLE,
      style: { "padding-left": 2 },
    });
    table.push([COLOR_HEADER(`Org Id`), COLOR_KEY_MESSAGE(org.getOrgId())]);
    table.push([
      COLOR_HEADER(`Instance URL`),
      COLOR_KEY_MESSAGE(org.getConnection().instanceUrl),
    ]);
    table.push([
      COLOR_HEADER(`Username`),
      COLOR_KEY_MESSAGE(org.getUsername()),
    ]);
    table.push([
      COLOR_HEADER(`Front Door URL`),
      COLOR_KEY_MESSAGE(org.getConnection().getAuthInfo().getOrgFrontDoorUrl())
    ]);
    SFPLogger.log(table.toString(), LoggerLevel.INFO);



    SFPLogger.printHeaderLine('', COLOR_HEADER, LoggerLevel.INFO);

    groupSection.end();
  }

  public static writeOrgInfoToMarkDown(org: SFPOrg): void {
    const pathToMarkDownFile = `org-info.md`;
    const fileOutputHandler = FileOutputHandler.getInstance();
    fileOutputHandler.appendOutput(pathToMarkDownFile, `\nPlease find the validation org details below`);
    let tableData = {
      table: {
          head:  [
              'Org Details',
              '',
          ],
          body: []
      },
      alignment: [Align.Left, Align.Left, Align.Left,Align.Right],
  };
    tableData.table.body.push([`Org Id`,org.getOrgId()]);
    tableData.table.body.push([`Username`,org.getUsername()]);
    tableData.table.body.push([`Login to the org`, `[Click Here](${org.getConnection().getAuthInfo().getOrgFrontDoorUrl()})`]);
    fileOutputHandler.appendOutput(pathToMarkDownFile, `\n\n${getMarkdownTable(tableData)}`);

  }

}
