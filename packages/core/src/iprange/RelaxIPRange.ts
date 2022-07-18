import * as fs from 'fs-extra';
import { Connection } from '@salesforce/core';
import AdmZip = require('adm-zip');
import path = require('path');
import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { delay } from '../utils/Delay';
import xml2json from '../utils/xml2json';
import { DeployResult } from 'jsforce/lib/api/metadata';

const xml2js = require('xml2js');

//TODO: Use jsForce upsert rather than full mdapi deploy
export default class RelaxIPRange {
    public constructor(private logger: Logger) {}

    public async setIp(
        conn: Connection,
        ipRangeToSet: any[],
        addall: boolean = false
    ): Promise<{ username: string; success: boolean }> {
        let retriveLocation = await this.fetchPackageFromOrg(conn, {
            types: { name: 'Settings', members: 'Security' },
        });

        let resultFile = `${retriveLocation}/settings/Security.settings`;

        if (fs.existsSync(path.resolve(resultFile))) {
            //Modify Component
            await this.modifySettingsMetadataForIPRanges(conn, resultFile, addall, ipRangeToSet);

            //Deploy Component
            SFPLogger.log(` Relaxing Ip range  in  ${conn.getUsername()}`, LoggerLevel.DEBUG, this.logger);
            let metadata_deploy_result = await this.deployPackage(conn, retriveLocation);

            //Report Success
            if (!metadata_deploy_result.success) {
                SFPLogger.log(
                    `Unable to  set ip range : ${metadata_deploy_result.details['componentFailures']['problem']}`,
                    LoggerLevel.ERROR,
                    this.logger
                );
                return { username: conn.getUsername(), success: false };
            } else {
                SFPLogger.log(`IP Ranges relaxed succesfully`, LoggerLevel.INFO, this.logger);
                return { username: conn.getUsername(), success: true };
            }
        } else {
            SFPLogger.log(`Unable to  set ip range`, LoggerLevel.ERROR, this.logger);
            return { username: conn.getUsername(), success: false };
        }
    }

    private async fetchPackageFromOrg(conn: Connection, members: any) {
        const apiversion = await conn.getApiVersion();

        let retrieveRequest = {
            apiVersion: Number(apiversion),
        };

        //Retrieve Security Settings
        retrieveRequest['singlePackage'] = true;
        retrieveRequest['unpackaged'] = members;
        conn.metadata.pollTimeout = 60;
        let retrieveResult = await conn.metadata.retrieve(retrieveRequest);
        SFPLogger.log(`Fetching  metadata from ${conn.getUsername()}`, LoggerLevel.DEBUG, this.logger);

        let metadata_retrieve_result = await this.checkRetrievalStatus(conn, retrieveResult.id);
        if (!metadata_retrieve_result.zipFile)
            SFPLogger.log('Unable to find the requested metadata', LoggerLevel.ERROR, this.logger);

        let retriveLocation = `.sfpowerscripts/retrieved/${retrieveResult.id}`;
        //Extract Security
        let zipFileName = `${retriveLocation}/unpackaged.zip`;
        fs.mkdirpSync(retriveLocation);
        fs.writeFileSync(zipFileName, metadata_retrieve_result.zipFile, {
            encoding: 'base64',
        });
        this.extract(retriveLocation, zipFileName);
        fs.unlinkSync(zipFileName);
        return retriveLocation;
    }

    private async deployPackage(conn: Connection, metadataLocation: string) {
        let zipFile = `${metadataLocation}/package.zip`;
        this.zipDirectory(metadataLocation, zipFile);
        conn.metadata.pollTimeout = 300;
        let zipStream = fs.createReadStream(zipFile);
        let deployId = await conn.metadata.deploy(zipStream, { rollbackOnError: true, singlePackage: true });
        let metadata_deploy_result = await this.checkDeploymentStatus(conn, deployId.id);
        fs.unlinkSync(zipFile);
        return metadata_deploy_result;
    }

    private getFullRange() {
        let ipRangeToSet = [];
        for (let i = 0; i < 255; i += 2) {
            ipRangeToSet.push({ start: `${i}.0.0.0`, end: `${i + 1}.255.255.255` });
        }
        return ipRangeToSet;
    }

    private async checkRetrievalStatus(conn: Connection, retrievedId: string, isToBeLoggedToConsole: boolean = true) {
        let metadata_result;

        while (true) {
            metadata_result = await conn.metadata.checkRetrieveStatus(retrievedId);

            if (metadata_result.done === 'false') {
                if (isToBeLoggedToConsole) SFPLogger.log(`Polling for Retrieval Status`, LoggerLevel.INFO, this.logger);
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

    private extract(unzippedDirectory: string, zipFile: string) {
        let zip = new AdmZip(zipFile);
        // Overwrite existing files
        zip.extractAllTo(unzippedDirectory, true);
    }

    private async checkDeploymentStatus(conn: Connection, retrievedId: string): Promise<DeployResult> {
        let metadata_result;

        while (true) {
            metadata_result = await conn.metadata.checkDeployStatus(retrievedId, true);

            if (!metadata_result.done) {
                SFPLogger.log('Polling for Deployment Status', LoggerLevel.INFO, this.logger);
                await delay(5000);
            } else {
                break;
            }
        }
        return metadata_result;
    }

    private async modifySettingsMetadataForIPRanges(
        conn: Connection,
        pathToMetadatFile: string,
        addall: boolean,
        ipRangeToSet: string[]
    ) {
        let retrieve_securitySetting: any = await xml2json(fs.readFileSync(pathToMetadatFile));

        if (addall) {
            ipRangeToSet = this.getFullRange();
            SFPLogger.log(`Ip range to set : 0.0.0.0-255.255.255.255`, LoggerLevel.INFO, this.logger);
        } else if (ipRangeToSet.length > 0) {
            SFPLogger.log(`Ip range to set :` + JSON.stringify(ipRangeToSet), LoggerLevel.INFO, this.logger);
        }

        if (!retrieve_securitySetting.SecuritySettings.networkAccess) {
            retrieve_securitySetting.SecuritySettings.networkAccess = {
                ipRanges: ipRangeToSet,
            };
        } else {
            let currentRange = retrieve_securitySetting.SecuritySettings.networkAccess.ipRanges;

            SFPLogger.log(
                `Org ${conn.getUsername()} has current range : ` + JSON.stringify(currentRange),
                LoggerLevel.DEBUG,
                this.logger
            );

            if (!addall) {
                if (currentRange.constructor === Array) {
                    ipRangeToSet = ipRangeToSet.concat(currentRange);
                } else {
                    ipRangeToSet.push(currentRange);
                }
            }
            retrieve_securitySetting.SecuritySettings.networkAccess.ipRanges = ipRangeToSet;
        }

        let builder = new xml2js.Builder();
        var xml = builder.buildObject(retrieve_securitySetting);
        fs.writeFileSync(pathToMetadatFile, xml);
    }
}
