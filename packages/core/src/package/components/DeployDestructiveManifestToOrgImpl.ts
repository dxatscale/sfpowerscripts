import SFPLogger from '@dxatscale/sfp-logger';
import { Connection } from '@salesforce/core';
import * as fs from 'fs-extra';
import { delay } from '../../utils/Delay';
import { LoggerLevel } from '@dxatscale/sfp-logger';
import SFPOrg from '../../org/SFPOrg';
import AdmZip from "adm-zip"
import path from 'path';
import tmp from "tmp";
import { XMLParser } from 'fast-xml-parser';
import { isEmpty } from 'lodash';

export default class DeployDestructiveManifestToOrgImpl {
    public constructor(private sfpOrg: SFPOrg, private destructiveManifestPath: string) { }




    public async exec(): Promise<void> {
        //Connect to the org
        const conn = this.sfpOrg.getConnection();
        const apiversion = await conn.retrieveMaxApiVersion();
        let workingDirectory = this.generateCacheDirectory();
        await this.copyAndValidateDestructiveManifest(this.destructiveManifestPath, workingDirectory);
        this.generateEmptyPackageXml(workingDirectory, apiversion);
        let zipFile = await this.generateDeploymentZipFile(workingDirectory);
        await this.deployDestructiveManifest(zipFile, conn);
    }

    private generateCacheDirectory() {

        let tmpDirObj = tmp.dirSync({ unsafeCleanup: true });
        let tempDir = tmpDirObj.name;
        let destructCacheDirectory = path.join(tempDir, 'destruct');
        fs.mkdirSync(destructCacheDirectory);
        return destructCacheDirectory;
    }

    private async copyAndValidateDestructiveManifest(existingManifestPath: string, workingDirectory: string) {
        let destructiveManifestFile = path.join(workingDirectory, 'destructiveChanges.xml');

        //Copy Destructive Manifest File to  Temporary Directory
        fs.copyFileSync(existingManifestPath, destructiveManifestFile);
        const parser = new XMLParser();
        let destructiveChanges = await  parser.parse(fs.readFileSync(path.resolve(destructiveManifestFile)));

        if (isEmpty(destructiveChanges['Package']['types'])) {
            throw new Error('Invalid Destructive Change Definition encountered, please check');
        }

        SFPLogger.log(destructiveChanges['Package']['types'], LoggerLevel.TRACE);
    }


    private generateEmptyPackageXml(workingDirectory: string, apiversion: string) {
        let packageXml = `<?xml version="1.0" encoding="UTF-8"?>
    <Package xmlns="http://soap.sforce.com/2006/04/metadata">
        <types>
            <members>*</members>
            <name>CustomLabel</name>
        </types>
        <version>${apiversion}</version>
    </Package>`;

        let packageXmlPath = path.join(workingDirectory, 'package.xml');
        fs.outputFileSync(packageXmlPath, packageXml);

        SFPLogger.log(`Empty Package.xml with ${apiversion} created at ${workingDirectory}`, LoggerLevel.DEBUG);
    }

    private async generateDeploymentZipFile(workingDirectory: string) {
        let zip = new AdmZip();
        zip.addLocalFolder(workingDirectory);
        zip.writeZip(path.join(workingDirectory, 'package.zip'));
        return path.join(workingDirectory, 'package.zip');
    }



    private async deployDestructiveManifest(zipFile: string, conn: Connection) {
        //Deploy Package
        conn.metadata.pollTimeout = 300;

        const zipStream = fs.createReadStream(zipFile);
        let deployResult = await conn.metadata.deploy(zipStream, { rollbackOnError: true, singlePackage: true });


        SFPLogger.log(
            `Deploying Destructive Changes with ID ${deployResult.id} to ${conn.getUsername()}`,
            LoggerLevel.INFO
        );
        let deploymentStatus = await this.checkDeploymentStatus(conn, deployResult.id);

        if (deploymentStatus.success) {
            if (deploymentStatus.success)
                SFPLogger.log(
                    `Deployed Destructive Changes  in target org ${conn.getUsername()} succesfully`,
                    LoggerLevel.INFO
                );
        } else {
            let componentFailures = deploymentStatus.details.componentFailures;
            let errorResult = [];
            componentFailures.forEach((failure) => {
                errorResult.push({
                    componentType: failure.componentType,
                    fullName: failure.fullName,
                    problem: failure.problem,
                });
            });

            console
            throw new Error('Unable to deploy the Destructive Changes: ' + JSON.stringify(errorResult));
        }
    }

    private async checkDeploymentStatus(conn: Connection, retrievedId: string) {

        while (true) {
            let result = await conn.metadata.checkDeployStatus(retrievedId, true);

            if (!result.done) {
                SFPLogger.log('Polling for Deployment Status', LoggerLevel.INFO);
                await delay(5000);
            } else {
                return result;
            }
        }
    }
}
