import SFPLogger from '../../logger/SFPLogger';
import { LoggerLevel, Org, SfdxError } from '@salesforce/core';
import child_process = require('child_process');
import { PoolBaseImpl } from './PoolBaseImpl';
import ScratchOrg from '../ScratchOrg';
import { getUserEmail } from './services/fetchers/GetUserEmail';
import ScratchOrgInfoFetcher from './services/fetchers/ScratchOrgInfoFetcher';
import ScratchOrgInfoAssigner from './services/updaters/ScratchOrgInfoAssigner';
import * as fs from 'fs-extra';
import ClientSourceTracking from './ClientSourceTracking';
import isValidSfdxAuthUrl from './prequisitecheck/IsValidSfdxAuthUrl';
import ScratchOrgOperator from '../ScratchOrgOperator';

export default class PoolFetchImpl extends PoolBaseImpl {
    private tag: string;
    private mypool: boolean;
    private sendToUser: string;
    private alias: string;
    private setdefaultusername: boolean;
    private authURLEnabledScratchOrg: boolean;
    private isSourceTrackingToBeSet: boolean = false;

    public constructor(
        hubOrg: Org,
        tag: string,
        mypool: boolean,
        authURLEnabledScratchOrg: boolean,
        sendToUser?: string,
        alias?: string,
        setdefaultusername?: boolean,
        private fetchAllScratchOrgs?: boolean
    ) {
        super(hubOrg);
        this.tag = tag;
        this.mypool = mypool;
        this.authURLEnabledScratchOrg = authURLEnabledScratchOrg;
        this.sendToUser = sendToUser;
        this.alias = alias;
        this.setdefaultusername = setdefaultusername;
    }

    public setSourceTrackingOnFetch() {
        this.isSourceTrackingToBeSet = true;
    }

    protected async onExec(): Promise<ScratchOrg | ScratchOrg[]> {
        const results = (await new ScratchOrgInfoFetcher(this.hubOrg).getScratchOrgsByTag(
            this.tag,
            this.mypool,
            true
        )) as any;

        let availableSo = [];
        if (results.records.length > 0) {
            availableSo = results.records.filter((soInfo) => soInfo.Allocation_status__c === 'Available');
        }
        if (availableSo.length == 0) {
            throw new SfdxError(`No scratch org available at the moment for ${this.tag}, try again in sometime.`);
        }

        if (this.fetchAllScratchOrgs) {
            return this.fetchAllScratchOrg(availableSo);
        } else return this.fetchSingleScratchOrg(availableSo);
    }

    private async fetchAllScratchOrg(availableSo: any[]): Promise<ScratchOrg[]> {
        let fetchedSOs: ScratchOrg[] = new Array();

        if (availableSo.length > 0) {
            SFPLogger.log(`${this.tag} pool has ${availableSo.length} Scratch orgs available`, LoggerLevel.TRACE);

            let count = 1;
            for (let element of availableSo) {
                if (this.authURLEnabledScratchOrg) {
                    if (element.SfdxAuthUrl__c && !isValidSfdxAuthUrl(element.SfdxAuthUrl__c)) {
                        SFPLogger.log(
                            `Iterating through pool to find a scratch org with valid authURL`,
                            LoggerLevel.TRACE
                        );
                        continue;
                    }
                }

                SFPLogger.log(
                    `Scratch org ${element.SignupUsername} is allocated from the pool. Expiry date is ${element.ExpirationDate}`,
                    LoggerLevel.TRACE
                );
                let soDetail: any = {};
                soDetail['Id'] = element.Id;
                soDetail.orgId = element.ScratchOrg;
                soDetail.loginURL = element.LoginUrl;
                soDetail.username = element.SignupUsername;
                soDetail.password = element.Password__c;
                soDetail.expiryDate = element.ExpirationDate;
                soDetail.sfdxAuthUrl = element.SfdxAuthUrl__c;
                soDetail.status = 'Available';
                soDetail.alias = `SO` + count++;
                fetchedSOs.push(soDetail);
            }
        }

        for (const soDetail of fetchedSOs) {
            try {
                //Login to the org
                let isLoginSuccessFull = this.loginToScratchOrgIfSfdxAuthURLExists(soDetail);
            } catch (error) {
                SFPLogger.log(`Unable to login to scratchorg ${soDetail.username}}`, LoggerLevel.ERROR);
                fetchedSOs = fetchedSOs.filter((item) => item.username !== soDetail.username);
            }
        }

        return fetchedSOs;
    }

    private async fetchSingleScratchOrg(availableSo: any[]): Promise<ScratchOrg> {
        let soDetail: ScratchOrg;

        if (availableSo.length > 0) {
            SFPLogger.log(`${this.tag} pool has ${availableSo.length} Scratch orgs available`, LoggerLevel.TRACE);

            for (let element of availableSo) {
                if (this.authURLEnabledScratchOrg) {
                    if (element.SfdxAuthUrl__c && !isValidSfdxAuthUrl(element.SfdxAuthUrl__c)) {
                        SFPLogger.log(
                            `Iterating through pool to find a scratch org with valid authURL`,
                            LoggerLevel.TRACE
                        );
                        continue;
                    }
                }

                let allocateSO = await new ScratchOrgInfoAssigner(this.hubOrg).setScratchOrgInfo({
                    Id: element.Id,
                    Allocation_status__c: 'Allocate',
                });
                if (allocateSO === true) {
                    SFPLogger.log(
                        `Scratch org ${element.SignupUsername} is allocated from the pool. Expiry date is ${element.ExpirationDate}`,
                        LoggerLevel.TRACE
                    );
                    soDetail = {};
                    soDetail['Id'] = element.Id;
                    soDetail.orgId = element.ScratchOrg;
                    soDetail.loginURL = element.LoginUrl;
                    soDetail.username = element.SignupUsername;
                    soDetail.password = element.Password__c;
                    soDetail.expiryDate = element.ExpirationDate;
                    soDetail.sfdxAuthUrl = element.SfdxAuthUrl__c;
                    soDetail.status = 'Assigned';

                    break;
                } else {
                    SFPLogger.log(
                        `Scratch org ${element.SignupUsername} allocation failed. trying to get another Scratch org from ${this.tag} pool`,
                        LoggerLevel.TRACE
                    );
                }
            }
        }

        if (availableSo.length == 0 || !soDetail) {
            throw new SfdxError(`No scratch org available at the moment for ${this.tag}, try again in sometime.`);
        }

        if (this.sendToUser) {
            //Fetch the email for user id
            let emailId;
            try {
                emailId = await getUserEmail(this.sendToUser, this.hubOrg);
            } catch (error) {
                SFPLogger.log(
                    'Unable to fetch details of the specified user, Check whether the user exists in the org ',
                    LoggerLevel.ERROR
                );
                throw new SfdxError('Failed to fetch user details');
            }

            try {
                //Send an email for username
                await new ScratchOrgOperator(this.hubOrg).shareScratchOrgThroughEmail(emailId, soDetail);
            } catch (error) {
                SFPLogger.log(
                    'Unable to send the scratchorg details to specified user. Check whether the user exists in the org',
                    LoggerLevel.ERROR
                );
                throw new SfdxError(
                    'Unable to send the scratchorg details to specified user. Check whether the user exists in the org'
                );
            }
        } else {
            //Login to the org
            let isLoginSuccessFull = this.loginToScratchOrgIfSfdxAuthURLExists(soDetail);
            //Attempt to Fetch Source Tracking Files and silently continue if it fails
            if (isLoginSuccessFull && this.isSourceTrackingToBeSet) {
                try {
                    const conn = (await Org.create({ aliasOrUsername: soDetail.username })).getConnection();
                    const clientSourceTracking = await ClientSourceTracking.create(conn, null);
                    await clientSourceTracking.creatSourceTrackingFiles();
                } catch (error) {
                    SFPLogger.log('Retriveing Source Tracking skipped.. ' + error.message, LoggerLevel.TRACE);
                }
            }
        }
        return soDetail;
    }

    public loginToScratchOrgIfSfdxAuthURLExists(soDetail: ScratchOrg): boolean {
        try {
            if (soDetail.sfdxAuthUrl && isValidSfdxAuthUrl(soDetail.sfdxAuthUrl)) {
                let soLogin: any = {};
                soLogin.sfdxAuthUrl = soDetail.sfdxAuthUrl;
                soLogin.devHubId = this.hubOrg.getUsername();
                fs.writeFileSync('soAuth.json', JSON.stringify(soLogin));

                SFPLogger.log(`Authenticating to Scratch Org ${soDetail.username}..`, LoggerLevel.INFO);

                let authURLStoreCommand: string = `sfdx auth:sfdxurl:store -f soAuth.json`;

                if (this.alias) authURLStoreCommand += ` -a ${this.alias}`;
                else if (soDetail.alias) authURLStoreCommand += ` -a ${soDetail.alias}`;

                if (this.setdefaultusername) authURLStoreCommand += ` --setdefaultusername`;

                child_process.execSync(authURLStoreCommand, {
                    encoding: 'utf8',
                    stdio: 'pipe',
                });

                return true;
            } else {
                SFPLogger.log('Unable to autenticate to the scratch org', LoggerLevel.INFO);
                return false;
            }
        } catch (error) {
            SFPLogger.log('Unable to autenticate to the scratch org due ' + error.message, LoggerLevel.ERROR);
            return false;
        } finally {
            if (fs.existsSync('soAuth.json')) fs.unlinkSync('soAuth.json');
        }
    }
}
