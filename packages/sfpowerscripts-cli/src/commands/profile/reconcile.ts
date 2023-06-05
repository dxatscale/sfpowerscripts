import { flags, FlagsConfig, SfdxResult, SfdxCommand } from '@salesforce/command';
import { AnyJson } from '@salesforce/ts-types';
import { Messages, Org }  from '@salesforce/core';
import * as _ from 'lodash';
import { Sfpowerkit } from '@dxatscale/sfprofiles/lib/utils/sfpowerkit';
import SFPLogger, { LoggerLevel } from '@dxatscale/sfp-logger';
import { METADATA_INFO } from '@dxatscale/sfprofiles/lib/impl/metadata/metadataInfo';
import * as path from 'path';
import ProfileReconcile from '@dxatscale/sfprofiles/lib/impl/source/profileReconcile';
import MetadataFiles from '@dxatscale/sfprofiles/lib/impl/metadata/metadataFiles';
import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';
const Table = require('cli-table');
import { ZERO_BORDER_TABLE } from '../../ui/TableConstants';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'profile_reconcile');

export default class Reconcile extends SfpowerscriptsCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfpowerscripts profile:reconcile  --folder force-app -d destfolder -s`,
        `$ sfpowerscripts profile:reconcile  --folder force-app,module2,module3 -u sandbox -d destfolder`,
        `$ sfpowerscripts profile:reconcile  -u myscratchorg -d destfolder`,
    ];

    //public static args = [{name: 'file'}];

    protected static flagsConfig: FlagsConfig = {
        // flag with a value (-n, --name=VALUE)
        folder: flags.array({
            char: 'f',
            description: messages.getMessage('folderFlagDescription'),
            required: false,
            map: (f: string) => f.trim(),
        }),
        profilelist: flags.array({
            char: 'n',
            description: messages.getMessage('nameFlagDescription'),
            required: false,
            map: (n: string) => n.trim(),
        }),
        destfolder: flags.directory({
            char: 'd',
            description: messages.getMessage('destFolderFlagDescription'),
            required: false,
        }),
        sourceonly: flags.boolean({
            char: 's',
            description: messages.getMessage('sourceonlyFlagDescription'),
            required: false,
        }),
        targetorg: flags.string({
            char: 'u',
            description: messages.getMessage('targetorgFlagDescription'),
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
    protected static requiresUsername = false;

    // Comment this out if your command does not support a hub org username
    //protected static supportsDevhubUsername = true;

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = true;

    public async execute(): Promise<Array<{state: any, fullName: any, type: any, path: any}>> {
        let argFolder = this.flags.folder;
        let argProfileList = this.flags.profilelist;

        if (!this.flags.sourceonly) {
            if (_.isNil(this.flags.targetorg)) {
                throw new Error('Either set sourceonly flag or provide and org for reconcile');
            } else {
                this.org = await Org.create({ aliasOrUsername: this.flags.targetorg });
            }
        }

        MetadataFiles.sourceOnly = this.flags.sourceonly;

        if (!_.isNil(argFolder) && argFolder.length !== 0) {
            Sfpowerkit.setDefaultFolder(argFolder[0]);
        }

        let result = [];

        try {
            let profileReconciler = new ProfileReconcile(this.org);
            let reconcileProfiles = await profileReconciler.reconcile(
                argFolder,
                argProfileList || [],
                this.flags.destfolder
            );

            // Return an object to be displayed with --json

            reconcileProfiles.forEach((file) => {
                result.push({
                    state: 'Cleaned',
                    fullName: path.basename(file, METADATA_INFO.Profile.sourceExtension),
                    type: 'Profile',
                    path: path.relative(process.cwd(), file),
                });
            });
        } catch (err) {
            SFPLogger.log(err, LoggerLevel.ERROR);

            SFPLogger.log(
                'An error occured during profile reconcile. You can rerun the command after a moment.',
                LoggerLevel.ERROR
            );
        }
            const table = new Table({
                head: ['State', 'Full Name', 'Type', 'Path'],
                chars: ZERO_BORDER_TABLE,
            });
        for (let res of result) {
            table.push([res.state, res.fullName, res.type, res.path]);
        }
        SFPLogger.log(table.toString(), LoggerLevel.INFO);
        return result;
    }
}
