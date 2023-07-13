import { flags, FlagsConfig } from '@salesforce/command';

import { SfdxError, Messages } from '@salesforce/core';
import * as fs from 'fs-extra';
import { isNil } from 'lodash';
import { Sfpowerkit } from '@dxatscale/sfprofiles/lib/utils/sfpowerkit';
import ProfileSync from '@dxatscale/sfprofiles/lib/impl/source/profileSync';
import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';
import Table from 'cli-table';
import { ZERO_BORDER_TABLE } from '../../ui/TableConstants';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'profile_retrieve');

export default class Retrieve extends SfpowerscriptsCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfpowerscripts source:profile:retrieve -u prod`,
        `$ sfpowerscripts source:profile:retrieve -f force-app -n "My Profile" -u prod`,
        `$ sfpowerscripts source:profile:retrieve -f "module1, module2, module3" -n "My Profile1, My profile2"  -u prod`,
    ];

    //public static args = [{ name: 'file' }];

    protected static flagsConfig: FlagsConfig = {
        folder: flags.array({
            char: 'f',
            description: messages.getMessage('folderFlagDescription'),
            required: false,
            map: (f: string) => f.trim(),
        }),
        profilelist: flags.array({
            char: 'n',
            description: messages.getMessage('profileListFlagDescription'),
            required: false,
            map: (p: string) => p.trim(),
        }),
        delete: flags.boolean({
            char: 'd',
            description: messages.getMessage('deleteFlagDescription'),
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
                    throw new SfdxError(`The profile path ${dir} does not exist.`);
                }
            }
            folders.push(...argFolder);
        }

        Sfpowerkit.initCache();

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
