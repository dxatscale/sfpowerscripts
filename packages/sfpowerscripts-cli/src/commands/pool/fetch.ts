import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import ScratchOrg from '@dxatscale/sfpowerscripts.core/lib/scratchorg/ScratchOrg';
import { AnyJson } from '@salesforce/ts-types';
import PoolFetchImpl from '@dxatscale/sfpowerscripts.core/lib/scratchorg/pool/PoolFetchImpl';
import * as fs from 'fs-extra';
import SFPLogger, { LoggerLevel } from '@dxatscale/sfp-logger';
import InstalledArtifactsDisplayer from '@dxatscale/sfpowerscripts.core/lib/display/InstalledArtifactsDisplayer';
import InstalledPackageDisplayer from '@dxatscale/sfpowerscripts.core/lib/display/InstalledPackagesDisplayer';
import { COLOR_KEY_MESSAGE } from '@dxatscale/sfp-logger';
import SFPOrg from '@dxatscale/sfpowerscripts.core/lib/org/SFPOrg';
import { COLOR_HEADER } from '@dxatscale/sfp-logger';
import { COLOR_SUCCESS } from '@dxatscale/sfp-logger';
import { COLOR_TIME } from '@dxatscale/sfp-logger';
import getFormattedTime from '@dxatscale/sfpowerscripts.core/lib/utils/GetFormattedTime';
import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'scratchorg_poolFetch');

export default class Fetch extends SfpowerscriptsCommand {
    public static description = messages.getMessage('commandDescription');

    protected static requiresDevhubUsername = true;
    protected static requiresProject = true;

    public static examples = [
        `$ sfdx sfpowerkit:pool:fetch -t core `,
        `$ sfdx sfpowerkit:pool:fetch -t core -v devhub`,
        `$ sfdx sfpowerkit:pool:fetch -t core -v devhub -m`,
        `$ sfdx sfpowerkit:pool:fetch -t core -v devhub -s testuser@test.com`,
    ];

    protected static flagsConfig = {
        tag: flags.string({
            char: 't',
            description: messages.getMessage('tagDescription'),
            required: true,
        }),
        alias: flags.string({
            char: 'a',
            description: messages.getMessage('aliasDescription'),
            required: false,
        }),
        sendtouser: flags.string({
            char: 's',
            description: messages.getMessage('sendToUserDescription'),
            required: false,
        }),
        setdefaultusername: flags.boolean({
            char: 'd',
            description: messages.getMessage('setdefaultusernameDescription'),
            required: false,
        }),
        nosourcetracking: flags.boolean({
            default: false,
            description: messages.getMessage('noSourceTrackingDescription'),
            required: false,
        }),
        loglevel: flags.enum({
            description: 'logging level for this command invocation',
            default: 'info',
            required: false,
            options: [
                'trace',
                'debug',
                'info',
                'warn',
                'error',
                'fatal',
                'TRACE',
                'DEBUG',
                'INFO',
                'WARN',
                'ERROR',
                'FATAL',
            ],
        }),
    };

    public async execute(): Promise<AnyJson> {
        const fetchStartTime: number = Date.now();

        if (!fs.existsSync('sfdx-project.json'))
            throw new Error('This command must be run in the root directory of a SFDX project');

        await this.hubOrg.refreshAuth();
        const hubConn = this.hubOrg.getConnection();

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

        if (this.flags.json) SFPLogger.logLevel = LoggerLevel.HIDE;

        let result = (await fetchImpl.execute()) as ScratchOrg;

        if (!this.flags.json && !this.flags.sendtouser) {
            await this.displayOrgContents(result);

            this.ux.log(`======== Scratch org details ========`);
            let list = [];
            for (let [key, value] of Object.entries(result)) {
                if (value) {
                    list.push({ key: key, value: value });
                }
            }
            //add alias info
            if (this.flags.alias) list.push({ key: 'alias', value: this.flags.alias });

            this.ux.table(list, ['key', 'value']);
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
        SFPLogger.log(
            COLOR_HEADER(
                `----------------------------------------------------------------------------------------------------`
            )
        );
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
        console.log(
            COLOR_HEADER(
                `----------------------------------------------------------------------------------------------------`
            )
        );
    }
}
