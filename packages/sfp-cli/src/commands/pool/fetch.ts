import { Messages } from '@salesforce/core';
import ScratchOrg from '../../core/scratchorg/ScratchOrg';
import { AnyJson } from '@salesforce/ts-types';
import PoolFetchImpl from '../../core/scratchorg/pool/PoolFetchImpl';
import * as fs from 'fs-extra';
import SFPLogger, { LoggerLevel } from '@flxblio/sfp-logger';
import InstalledArtifactsDisplayer from '../../core/display/InstalledArtifactsDisplayer';
import InstalledPackageDisplayer from '../../core/display/InstalledPackagesDisplayer';
import { COLOR_KEY_MESSAGE } from '@flxblio/sfp-logger';
import SFPOrg from '../../core/org/SFPOrg';
import { COLOR_HEADER } from '@flxblio/sfp-logger';
import { COLOR_SUCCESS } from '@flxblio/sfp-logger';
import { COLOR_TIME } from '@flxblio/sfp-logger';
import getFormattedTime from '../../core/utils/GetFormattedTime';
import SfpCommand from '../../SfpCommand';
import { Flags, ux } from '@oclif/core';
import { loglevel, orgApiVersionFlagSfdxStyle, targetdevhubusername } from '../../flags/sfdxflags';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@flxblio/sfp', 'scratchorg_poolFetch');

export default class Fetch extends SfpCommand {
    public static description = messages.getMessage('commandDescription');

    protected static requiresDevhubUsername = true;
    public static enableJsonFlag = true;

    public static examples = [
        `$ sfp pool:fetch  -t core `,
        `$ sfp pool:fetch  -t core -v devhub`,
        `$ sfp pool:fetch  -t core -v devhub -m`,
        `$ sfp pool:fetch  -t core -v devhub -s testuser@test.com`,
    ];

    public static flags = {
        targetdevhubusername,
        tag: Flags.string({
            char: 't',
            description: messages.getMessage('tagDescription'),
            required: true,
        }),
        alias: Flags.string({
            char: 'a',
            description: messages.getMessage('aliasDescription'),
            required: false,
        }),
        sendtouser: Flags.string({
            char: 's',
            description: messages.getMessage('sendToUserDescription'),
            required: false,
        }),
        setdefaultusername: Flags.boolean({
            char: 'd',
            description: messages.getMessage('setdefaultusernameDescription'),
            required: false,
        }),
        nosourcetracking: Flags.boolean({
            default: false,
            description: messages.getMessage('noSourceTrackingDescription'),
            required: false,
        }),
        'apiversion': orgApiVersionFlagSfdxStyle,
        loglevel
    };

    public async execute(): Promise<AnyJson> {
        const fetchStartTime: number = Date.now();


        await this.hubOrg.refreshAuth();
        const hubConn = this.hubOrg.getConnection();

        if (this.flags.json) SFPLogger.logLevel = LoggerLevel.HIDE;

        SFPLogger.log(
            COLOR_KEY_MESSAGE(`Fetching a scratch org from pool ${this.flags.tag} in Org ${this.hubOrg.getOrgId()}`),
            LoggerLevel.INFO
        );

        this.flags.apiversion = this.flags.apiversion || (await hubConn.retrieveMaxApiVersion());

        let fetchImpl = new PoolFetchImpl(
            this.hubOrg,
            this.flags.tag,
            false,
            false,
            this.flags.sendtouser,
            this.flags.alias,
            this.flags.setdefaultusername
        );

        if (!this.flags.nosourcetracking) {
            SFPLogger.log(
                COLOR_KEY_MESSAGE(`Enabling source tracking, this will take a bit of time, please hang on`)
            );
            fetchImpl.setSourceTrackingOnFetch();
        }

        let result = (await fetchImpl.execute()) as ScratchOrg;

        if (!this.flags.json && !this.flags.sendtouser) {
            await this.displayOrgContents(result);

            ux.log(`======== Scratch org details ========`);
            let list = [];
            for (let [key, value] of Object.entries(result)) {
                if (value) {
                    list.push({ key: key, value: value });
                }
            }
            //add alias info
            if (this.flags.alias) list.push({ key: 'alias', value: this.flags.alias });

            ux.table(list, {key:{},value:{}});
            this.printFetchSummary(!this.flags.nosourcetracking, Date.now() - fetchStartTime);
        }

        return result as AnyJson;
    }

    /**
     * Display artifacts and managed packages installed in the org
     * @param soDetail
     */
    private async displayOrgContents(soDetail: ScratchOrg) {
        try {
            let scratchOrgAsSFPOrg = await SFPOrg.create({ aliasOrUsername: soDetail.username });
            let installedManagedPackages = await scratchOrgAsSFPOrg.getAllInstalledManagedPackages();
            SFPLogger.log('Installed managed packages:', LoggerLevel.INFO);
            InstalledPackageDisplayer.printInstalledPackages(installedManagedPackages, null);

            let installedArtifacts = await scratchOrgAsSFPOrg.getInstalledArtifacts();
            InstalledArtifactsDisplayer.printInstalledArtifacts(installedArtifacts, null);
        } catch (error) {
            SFPLogger.log(
                'Failed to query packages/artifacts installed in the org due to \n' + error.message,
                LoggerLevel.ERROR
            );
        }
    }

    private printFetchSummary(isSourceTrackingEnabled: boolean, totalElapsedTime: number): void {
        SFPLogger.printHeaderLine('',COLOR_HEADER,LoggerLevel.INFO);
        if (!isSourceTrackingEnabled) {
            SFPLogger.log(
                COLOR_SUCCESS(`Succesfully fetched a scratch org in ${COLOR_TIME(getFormattedTime(totalElapsedTime))}`)
            );
        } else {
            SFPLogger.log(
                COLOR_SUCCESS(
                    `Succesfully fetched a scratch org and enabled source tracking  in ${COLOR_TIME(
                        getFormattedTime(totalElapsedTime)
                    )}`
                )
            );
        }
        SFPLogger.printHeaderLine('',COLOR_HEADER,LoggerLevel.INFO);
    }
}
