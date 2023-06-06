import SFPLogger, { COLOR_HEADER, COLOR_KEY_VALUE, COLOR_KEY_MESSAGE, COLOR_TRACE } from "@dxatscale/sfp-logger";
import SFPOrg from "@dxatscale/sfpowerscripts.core/lib/org/SFPOrg";
const Table = require("cli-table");
import { LoggerLevel } from "@salesforce/core";
import GroupConsoleLogs from "./GroupConsoleLogs";
import { COLON_MIDDLE_BORDER_TABLE } from "./TableConstants";
import ScratchOrg from "@dxatscale/sfpowerscripts.core/lib/scratchorg/ScratchOrg";

export default class OrgInfoDisplayer
{

   public static printScratchOrgInfo(scratchOrg:ScratchOrg): void {
    let groupSection = new GroupConsoleLogs(`Display Org Info`).begin();

    SFPLogger.log(
      COLOR_HEADER(
        `----------------------------------------------------------------------------------------------`,
      ),
    );
    SFPLogger.log(COLOR_KEY_VALUE(`-- Org Details:--`));
    const table = new Table({
      chars: COLON_MIDDLE_BORDER_TABLE,
      style: { "padding-left": 2 },
    });
    table.push([COLOR_HEADER(`Org Id`), COLOR_KEY_MESSAGE(scratchOrg.orgId)]);
    table.push([
      COLOR_HEADER(`Instance URL`),
      COLOR_KEY_MESSAGE(scratchOrg.instanceURL),
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
      COLOR_TRACE(`cat ${scratchOrg.sfdxAuthUrl} > ./authfile`),
      LoggerLevel.INFO,
    );
    SFPLogger.log(
      COLOR_TRACE(`sfdx auth sfdxurl store  --sfdxurlfile authfile`),
      LoggerLevel.INFO,
    );
    SFPLogger.log(
      COLOR_TRACE(`sfdx force org open  --u ${scratchOrg.username}`),
      LoggerLevel.INFO,
    );

    SFPLogger.log(
      COLOR_HEADER(
        `----------------------------------------------------------------------------------------------`,
      ),
    );

    groupSection.end();
   }


   public static  printOrgInfo(org:SFPOrg): void {
    let groupSection = new GroupConsoleLogs(`Display Org Info`).begin();

    SFPLogger.log(
      COLOR_HEADER(
        `----------------------------------------------------------------------------------------------`,
      ),
    );
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

   

    SFPLogger.log(
      COLOR_HEADER(
        `----------------------------------------------------------------------------------------------`,
      ),
    );

    groupSection.end();
   }

}