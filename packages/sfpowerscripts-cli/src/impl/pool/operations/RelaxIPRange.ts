import * as fs from "fs-extra";
import * as rimraf from "rimraf";
import { AsyncResult, DeployResult } from "jsforce";
import { Connection } from "@salesforce/core";
import SFPLogger, { LoggerLevel } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import AdmZip from "adm-zip";
import path from "path";
import xml2json from "@dxatscale/sfpowerscripts.core/lib/utils/xml2json"
import { delay } from "@dxatscale/sfpowerscripts.core/lib/utils/Delay";
const xml2js=require("xml2js");



export default class RelaxIPRange {

  public constructor(private logger:any)
  {
  }

  public  async setIp(
    conn: Connection,
    username: string,
    ipRangeToSet: any[],
    addall: Boolean = false,
    removeall: Boolean = false
  ): Promise<{ username: string; success: boolean }> {

    const apiversion = await conn.retrieveMaxApiVersion();

    let retrieveRequest = {
      apiVersion: apiversion
    };

    //Retrieve Security Settings
    retrieveRequest["singlePackage"] = true;
    retrieveRequest["unpackaged"] = {
      types: { name: "Settings", members: "Security" }
    };
    conn.metadata.pollTimeout = 60;
    let retrievedId;
    await conn.metadata.retrieve(retrieveRequest, function(
      error,
      result: AsyncResult
    ) {
      if (error) {
        return console.error(error);
      }
      retrievedId = result.id;
    });
    SFPLogger.log(
      `Fetching Ip range from ${conn.getUsername()}`,null,null,
      LoggerLevel.DEBUG
    );

    let metadata_retrieve_result = await this.checkRetrievalStatus(
      conn,
      retrievedId
    );
    if (!metadata_retrieve_result.zipFile)
      SFPLogger.log("Unable to find the settings",null, null, LoggerLevel.ERROR);

    let retriveLocation = `.sfpowerscripts/${retrievedId}`;
    //Extract Security
    var zipFileName = `${retriveLocation}/unpackaged.zip`;
    fs.mkdirSync(retriveLocation);
    fs.writeFileSync(zipFileName, metadata_retrieve_result.zipFile, {
      encoding: "base64"
    });

    this.extract(`./${retriveLocation}/unpackaged.zip`, retriveLocation);
    fs.unlinkSync(zipFileName);
    let resultFile = `${retriveLocation}/settings/Security.settings`;

    if (fs.existsSync(path.resolve(resultFile))) {


      let retrieve_securitySetting:any = await xml2json(resultFile);

      if (addall) {
        ipRangeToSet = this.getFullRange();
        SFPLogger.log(
          `Ip range to set : 0.0.0.0-255.255.255.255`,
          null,
          null,
          LoggerLevel.INFO
        );
      } else if (ipRangeToSet.length > 0) {
        SFPLogger.log(
          `Ip range to set :` + JSON.stringify(ipRangeToSet),
          null,
          this.logger,
          LoggerLevel.INFO
        );
      }

      if (!retrieve_securitySetting.SecuritySettings.networkAccess) {
        if (removeall) {
          SFPLogger.log(
            `Currently No Ip range set in ${conn.getUsername()} to remove.`,
            null,
            this.logger,
            LoggerLevel.INFO
          );
          rimraf.sync(retriveLocation);
          return { username: username, success: true };
        } else {
          retrieve_securitySetting.SecuritySettings.networkAccess = {
            ipRanges: ipRangeToSet
          };
          SFPLogger.log(
            `Currently No Ip range set in ${conn.getUsername()}.`,
            null,
            this.logger,
            LoggerLevel.DEBUG
          );
        }
      } else {
        let currentRange =
          retrieve_securitySetting.SecuritySettings.networkAccess.ipRanges;

        SFPLogger.log(
          `Org ${conn.getUsername()} has current range : ` +
            JSON.stringify(currentRange),
          null,
          this.logger,
          LoggerLevel.DEBUG
        );

        if (!addall && !removeall) {
          if (currentRange.constructor === Array) {
            ipRangeToSet.concat(currentRange);
          } else {
            ipRangeToSet.push(currentRange);
          }
        }
        retrieve_securitySetting.SecuritySettings.networkAccess.ipRanges = ipRangeToSet;
      }

      let builder = new xml2js.Builder();
      var xml = builder.buildObject(retrieve_securitySetting);
      fs.writeFileSync(resultFile, xml);

      var zipFile = `${retriveLocation}/package.zip`;
      this.zipDirectory(retriveLocation, zipFile);


      //Deploy Trigger
      conn.metadata.pollTimeout = 300;
      let deployId: AsyncResult;

      var zipStream = fs.createReadStream(zipFile);
      await conn.metadata.deploy(
        zipStream,
        { rollbackOnError: true, singlePackage: true },
        function(error, result: AsyncResult) {
          if (error) {
            return console.error(error);
          }
          deployId = result;
        }
      );

      SFPLogger.log(
        `${removeall ? "Removing all" : "Setting"} Ip range with ID  ${
          deployId.id
        } to ${conn.getUsername()}`,
        null,
        this.logger,
        LoggerLevel.DEBUG
      );
      let metadata_deploy_result: DeployResult = await this.checkDeploymentStatus(
        conn,
        deployId.id
      );

      rimraf.sync(retriveLocation);

      if (!metadata_deploy_result.success) {
        SFPLogger.log(
          `Unable to ${removeall ? "remove" : "set"} ip range : ${
            metadata_deploy_result.details["componentFailures"]["problem"]
          }`,
          null,
          this.logger,
          LoggerLevel.ERROR
        );
        return { username: username, success: false };
      } else {
        SFPLogger.log(
          `Ip range is successfully ${
            removeall ? "removed" : "set"
          } in ${conn.getUsername()}`,
          null,
          null,
          LoggerLevel.INFO
        );
        return { username: username, success: true };
      }
    }
  }
  

  private getFullRange() {
    let ipRangeToSet = [];
    for (let i = 0; i < 255; i += 2) {
      ipRangeToSet.push({ start: `${i}.0.0.0`, end: `${i + 1}.255.255.255` });
    }
    return ipRangeToSet;
  }

  private async checkRetrievalStatus(
    conn: Connection,
    retrievedId: string,
    isToBeLoggedToConsole: boolean = true
  ) {
    let metadata_result;
  
    while (true) {
      await conn.metadata.checkRetrieveStatus(retrievedId, function(
        error,
        result
      ) {
        if (error) {
          return new Error(error.message);
        }
        metadata_result = result;
      });
  
      if (metadata_result.done === "false") {
        if (isToBeLoggedToConsole)
          SFPLogger.log(`Polling for Retrieval Status`,null,this.logger, LoggerLevel.INFO);
        await delay(5000);
      } else {
        //this.ux.logJson(metadata_result);
        break;
      }
    }
    return metadata_result;
  }
  
  private zipDirectory(unzippedDirectory: string, zipFile: string) {
    let zip = new AdmZip();
     zip.addLocalFolder(unzippedDirectory);
     zip.writeZip(zipFile);
  }
 
  private extract(unzippedDirectory:string,zipFile:string)
  {
    fs.mkdirpSync(unzippedDirectory);
    let zip = new AdmZip(zipFile);

    // Overwrite existing files
    zip.extractAllTo(unzippedDirectory, true);
  }

 private async checkDeploymentStatus(
    conn: Connection,
    retrievedId: string
  ): Promise<DeployResult> {
    let metadata_result;
  
    while (true) {
      await conn.metadata.checkDeployStatus(retrievedId, true, function(
        error,
        result
      ) {
        if (error) {
          throw new Error(error.message);
        }
        metadata_result = result;
      });
  
      if (!metadata_result.done) {
        SFPLogger.log("Polling for Deployment Status", null,this.logger,LoggerLevel.INFO);
        await delay(5000);
      } else {
        break;
      }
    }
    return metadata_result;
  }

}
