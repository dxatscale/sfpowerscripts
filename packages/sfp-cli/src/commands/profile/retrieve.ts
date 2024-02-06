import { Messages, Org }  from '@salesforce/core';
import * as fs from 'fs-extra';
import { isNil } from 'lodash';
import { Sfpowerkit } from '@flxblio/sfprofiles/lib/utils/sfpowerkit';
import ProfileSync from '@flxblio/sfprofiles/lib/impl/source/profileSync';
import SfpCommand from '../../SfpCommand';
import Table from 'cli-table';
import { ZERO_BORDER_TABLE } from '../../ui/TableConstants';
import { arrayFlagSfdxStyle, loglevel, orgApiVersionFlagSfdxStyle, requiredUserNameFlag } from '../../flags/sfdxflags';
import { Flags } from '@oclif/core';
import SFPLogger, { COLOR_KEY_MESSAGE, COLOR_WARNING, LoggerLevel } from '@flxblio/sfp-logger';


Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@flxblio/sfp', 'profile_retrieve');

export default class Retrieve extends SfpCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfp profile:retrieve -u prod`,
        `$ sfp profile:retrieve -f force-app -n "My Profile" -u prod`,
        `$ sfp profile:retrieve -f "module1, module2, module3" -n "My Profile1, My profile2"  -u prod`,
    ];


    public static flags = {
        folder: arrayFlagSfdxStyle({
            char: 'f',
            description: messages.getMessage('folderFlagDescription'),
            required: false,
        }),
        profilelist: arrayFlagSfdxStyle({
            char: 'n',
            description: messages.getMessage('profileListFlagDescription'),
            required: false,
        }),
        delete: Flags.boolean({
            char: 'd',
            description: messages.getMessage('deleteFlagDescription'),
            required: false,
        }),
        targetorg: requiredUserNameFlag,
        'apiversion': orgApiVersionFlagSfdxStyle,
        loglevel,
    };

    // Comment this out if your command does not require an org username
    protected static requiresUsername = true;

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = true;

    public async execute(): Promise<any> {
        let argFolder: string = this.flags.folder;
        let argProfileList: string[] = this.flags.profilelist;

        let folders: string[] = [];
        if (!isNil(argFolder) && argFolder.length !== 0) {
            for (let dir of argFolder) {
                if (!fs.existsSync(dir)) {
                    throw new Error(`The profile path ${dir} does not exist.`);
                }
            }
            folders.push(...argFolder);
        }

        Sfpowerkit.initCache();

        SFPLogger.log(COLOR_WARNING(messages.getMessage('retriveDelayWarning')),LoggerLevel.INFO);
        SFPLogger.log(COLOR_KEY_MESSAGE(`Retrieving profiles from ${this.flags.targetorg}`),LoggerLevel.INFO );
      
        this.org = await Org.create({ aliasOrUsername: this.flags.targetorg });
        const profileUtils = new ProfileSync(this.org);

        let syncProfiles = await profileUtils.sync(folders, argProfileList || [], this.flags.delete);

        const table = new Table({
            head: ['State', 'Full Name', 'Type', 'Path'],
            chars: ZERO_BORDER_TABLE,
        });
        if (syncProfiles.added) {
            syncProfiles.added.forEach((profile) => {
                table.push({
                    state: 'Add',
                    fullName: profile.name,
                    type: 'Profile',
                    path: profile.path,
                });
            });
        }
        if (syncProfiles.updated) {
            syncProfiles.updated.forEach((profile) => {
                table.push({
                    state: 'Updated',
                    fullName: profile.name,
                    type: 'Profile',
                    path: profile.path,
                });
            });
        }
        if (this.flags.delete) {
            if (syncProfiles.deleted) {
                syncProfiles.deleted.forEach((profile) => {
                    table.push({
                        state: 'Deleted',
                        fullName: profile.name,
                        type: 'Profile',
                        path: profile.path,
                    });
                });
            }
        } else {
            if (syncProfiles.deleted) {
                syncProfiles.deleted.forEach((profile) => {
                    table.push({
                        state: 'Skipped',
                        fullName: profile.name,
                        type: 'Profile',
                        path: profile.path,
                    });
                });
            }
        }

        return syncProfiles;
    }
}
