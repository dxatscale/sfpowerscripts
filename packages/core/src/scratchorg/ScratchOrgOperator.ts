import { AuthInfo, Org, StateAggregator } from '@salesforce/core';
import ScratchOrg from './ScratchOrg';
import PasswordGenerator from './PasswordGenerator';
import SFPLogger, { LoggerLevel } from '@dxatscale/sfp-logger';
import { Duration } from '@salesforce/kit';
import { ScratchOrgRequest } from '@salesforce/core';
import { COLOR_KEY_MESSAGE } from '@dxatscale/sfp-logger';
import getFormattedTime from '../utils/GetFormattedTime';
import SFPStatsSender from '../stats/SFPStatsSender';
const retry = require('async-retry');

export default class ScratchOrgOperator {
    constructor(private hubOrg: Org) {}

    public async create(
        alias: string,
        config_file_path: string,
        expiry: number,
        waitTime: number = 6
    ): Promise<ScratchOrg> {
        SFPLogger.log('Parameters: ' + alias + ' ' + config_file_path + ' ' + expiry + ' ', LoggerLevel.TRACE);

        let startTime = Date.now();
        SFPLogger.log(`Requesting Scratch Org ${alias}..`, LoggerLevel.INFO);
        let scatchOrgResult = await this.requestAScratchOrg(
            alias,
            config_file_path,
            Duration.days(expiry),
            Duration.minutes(waitTime)
        );
        SFPLogger.log(JSON.stringify(scatchOrgResult), LoggerLevel.TRACE);

        //create scratchOrg object
        let scratchOrg: ScratchOrg = {
            alias: alias,
            orgId: scatchOrgResult.orgId,
            username: scatchOrgResult.username,
            loginURL: scatchOrgResult.loginURL,
            elapsedTime: Date.now() - startTime,
        };

        try {
            //Get Sfdx Auth URL
            const authInfo = await AuthInfo.create({ username: scratchOrg.username });
            scratchOrg.sfdxAuthUrl = authInfo.getSfdxAuthUrl();
        } catch (error) {
            throw new Error(
                `Unable to set auth URL, Ignoring this scratch org, as its not suitable for pool due to ${error.message}`
            );
        }

        //Generate Password
        let passwordData = await new PasswordGenerator().exec(scratchOrg.username);

        scratchOrg.password = passwordData.password;

        if (!passwordData.password) {
            throw new Error('Unable to setup password to scratch org');
        } else {
            SFPLogger.log(`Password successfully set for ${scratchOrg.alias}`, LoggerLevel.DEBUG);
        }

        SFPLogger.log(
            `Creation request for Scratch Org ${scratchOrg.alias} is completed successfully in ${COLOR_KEY_MESSAGE(
                getFormattedTime(scratchOrg.elapsedTime)
            )}`,
            LoggerLevel.INFO
        );
        SFPStatsSender.logElapsedTime(`scratchorg.creation.time`,scratchOrg.elapsedTime)
        return scratchOrg;
    }

    public async delete(scratchOrgIds: string[]) {
        let hubConn = this.hubOrg.getConnection();

        await retry(
            async (bail) => {
                let result = await hubConn.del('ActiveScratchOrg', scratchOrgIds);
            },
            { retries: 3, minTimeout: 3000 }
        );
    }

    private async requestAScratchOrg(alias: string, definitionFile: string, expireIn: Duration, waitTime: Duration) {
        const createCommandOptions: ScratchOrgRequest = {
            durationDays: expireIn.days,
            nonamespace: false,
            noancestors: false,
            wait: waitTime,
            retry: 3,
            definitionfile: definitionFile,
        };

        const { username, scratchOrgInfo, authFields, warnings } = await this.hubOrg.scratchOrgCreate(
            createCommandOptions
        );

        await this.setAliasForUsername(username, alias);

        return {
            username: username,
            loginURL: scratchOrgInfo.LoginUrl,
            warnings,
            orgId: authFields.orgId,
        };
    }

    public async shareScratchOrgThroughEmail(emailId: string, scratchOrg: ScratchOrg) {
        let hubOrgUserName = this.hubOrg.getUsername();
        let apiVersion = this.hubOrg.getConnection().retrieveMaxApiVersion();
        let body = `${hubOrgUserName} has fetched a new scratch org from the Scratch Org Pool!\n
   All the post scratch org scripts have been succesfully completed in this org!\n
   The Login url for this org is : ${scratchOrg.loginURL}\n
   Username: ${scratchOrg.username}\n
   Password: ${scratchOrg.password}\n
   Please use sfdx force:auth:web:login -r ${scratchOrg.loginURL} -a <alias> command to authenticate against this Scratch org</p>
   Thank you for using SFPLogger!`;

        const options = {
            method: 'POST',
            body: JSON.stringify({
                inputs: [
                    {
                        emailBody: body,
                        emailAddresses: emailId,
                        emailSubject: `${hubOrgUserName} created you a new Salesforce org`,
                        senderType: 'CurrentUser',
                    },
                ],
            }),
            url: `/services/data/v${apiVersion}actions/standard/emailSimple`,
        };

        await retry(
            async (bail) => {
                await this.hubOrg.getConnection().requestPost(options.url, options.body);
            },
            { retries: 3, minTimeout: 30000 }
        );

        SFPLogger.log(`Succesfully send email to ${emailId} for ${scratchOrg.username}`, LoggerLevel.INFO);
    }

    private async setAliasForUsername(username: string, aliasToSet: string): Promise<void> {
        const stateAggregator = await StateAggregator.getInstance();
        stateAggregator.aliases.set(aliasToSet, { username: username });
        await stateAggregator.aliases.write();
    }
}
