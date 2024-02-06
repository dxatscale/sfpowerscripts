import { Messages, Org }  from '@salesforce/core';
import * as _ from 'lodash';
import { Sfpowerkit } from '@flxblio/sfprofiles/lib/utils/sfpowerkit';
import SFPLogger, { LoggerLevel } from '@flxblio/sfp-logger';
import { METADATA_INFO } from '@flxblio/sfprofiles/lib/impl/metadata/metadataInfo';
import * as path from 'path';
import ProfileReconcile from '@flxblio/sfprofiles/lib/impl/source/profileReconcile';
import MetadataFiles from '@flxblio/sfprofiles/lib/impl/metadata/metadataFiles';
import SfpCommand from '../../SfpCommand';
const Table = require('cli-table');
import { ZERO_BORDER_TABLE } from '../../ui/TableConstants';
import { Flags } from '@oclif/core';
import { arrayFlagSfdxStyle, loglevel, orgApiVersionFlagSfdxStyle, requiredUserNameFlag } from '../../flags/sfdxflags';

Messages.importMessagesDirectory(__dirname);


const messages = Messages.loadMessages('@flxblio/sfp', 'profile_reconcile');

export default class Reconcile extends SfpCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfp profile:reconcile  --folder force-app -d destfolder -s`,
        `$ sfp profile:reconcile  --folder force-app,module2,module3 -u sandbox -d destfolder`,
        `$ sfp profile:reconcile  -u myscratchorg -d destfolder`,
    ];



    public static flags = {
        folder:arrayFlagSfdxStyle({
            char: 'f',
            description: messages.getMessage('folderFlagDescription'),
            required: false,
        }),
        profilelist: arrayFlagSfdxStyle({
            char: 'n',
            description: messages.getMessage('nameFlagDescription'),
            required: false,
        }),
        destfolder: Flags.directory({
            char: 'd',
            description: messages.getMessage('destFolderFlagDescription'),
            required: false,
        }),
        sourceonly: Flags.boolean({
            char: 's',
            description: messages.getMessage('sourceonlyFlagDescription'),
            required: false,
        }),
        targetorg: requiredUserNameFlag,
        'apiversion': orgApiVersionFlagSfdxStyle,
        loglevel,
        
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
