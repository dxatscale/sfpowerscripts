import { Messages, Org }  from '@salesforce/core';
import { isNil } from 'lodash';
import { Sfpowerkit } from '@flxblio/sfprofiles/lib/utils/sfpowerkit';
import SFPLogger, { LoggerLevel } from '@flxblio/sfp-logger';
import ProfileRetriever from '@flxblio/sfprofiles/lib/impl/metadata/retriever/profileRetriever';
import ProfileMerge from '@flxblio/sfprofiles/lib/impl/source/profileMerge';
import SfpCommand from '../../SfpCommand';
import Table from 'cli-table';
import { ZERO_BORDER_TABLE } from '../../ui/TableConstants';
import { arrayFlagSfdxStyle, loglevel, orgApiVersionFlagSfdxStyle, requiredUserNameFlag } from '../../flags/sfdxflags';
import { Flags } from '@oclif/core';

Messages.importMessagesDirectory(__dirname);

const messages = Messages.loadMessages('@flxblio/sfp', 'profile_merge');

export default class Merge extends SfpCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfp profile:merge -u sandbox`,
        `$ sfp profile:merge -f force-app -n "My Profile" -u sandbox`,
        `$ sfp  profile:merge -f "module1, module2, module3" -n "My Profile1, My profile2"  -u sandbox`,
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
        metadata: arrayFlagSfdxStyle({
            char: 'm',
            description: messages.getMessage('metadataFlagDescription'),
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
    protected static requiresUsername = true

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = true;

    public async execute(): Promise<any> {
        let argFolder = this.flags.folder;
        let argProfileList = this.flags.profilelist;
        let argMetadatas = this.flags.metadata;

        //  argMetadatas = (val: string) => {
        //         let parts = val.split(':');
        //         return {
        //             MetadataType: parts[0].trim(),
        //             ApiName: parts.length >= 2 ? parts[1].trim() : '*',
        //         };
        //     };

        Sfpowerkit.initCache();

        let metadatas = undefined;
        let invalidArguments = [];

        if (argMetadatas !== undefined) {
            metadatas = {};
            ProfileRetriever.supportedMetadataTypes.forEach((val) => {
                metadatas[val] = [];
            });
            for (let i = 0; i < argMetadatas.length; i++) {
                if (ProfileRetriever.supportedMetadataTypes.includes(argMetadatas[i].MetadataType)) {
                    metadatas[argMetadatas[i].MetadataType].push(argMetadatas[i].ApiName);
                } else {
                    invalidArguments.push(argMetadatas[i].MetadataType);
                }
            }
            if (invalidArguments.length > 0) {
                throw new Error(
                    'Metadata(s) ' + invalidArguments.join(', ') + ' is/are not supported.'
                );
            }
        }

        if (!isNil(argFolder) && argFolder.length !== 0) {
            Sfpowerkit.setDefaultFolder(argFolder[0]);
        }
        ``;


        this.org = await Org.create({ aliasOrUsername: this.flags.targetorg });
        const profileUtils = new ProfileMerge(this.org);

        let mergedProfiles = await profileUtils.merge(argFolder, argProfileList || [], metadatas, this.flags.delete);

        const table = new Table({
            head: ['State', 'Full Name', 'Type', 'Path'],
            chars: ZERO_BORDER_TABLE,
        });
        if (mergedProfiles.added) {
            mergedProfiles.added.forEach((profile) => {
                table.push({
                    state: 'Add',
                    fullName: profile.name,
                    type: 'Profile',
                    path: profile.path,
                });
            });
        }
        if (mergedProfiles.updated) {
            mergedProfiles.updated.forEach((profile) => {
                table.push({
                    state: 'Merged',
                    fullName: profile.name,
                    type: 'Profile',
                    path: profile.path,
                });
            });
        }
        if (this.flags.delete) {
            if (mergedProfiles.deleted) {
                mergedProfiles.deleted.forEach((profile) => {
                    table.push({
                        state: 'Deleted',
                        fullName: profile.name,
                        type: 'Profile',
                        path: profile.path,
                    });
                });
            }
        } else {
            if (mergedProfiles.deleted) {
                mergedProfiles.deleted.forEach((profile) => {
                    table.push({
                        state: 'Skipped',
                        fullName: profile.name,
                        type: 'Profile',
                        path: profile.path,
                    });
                });
            }
        }
        SFPLogger.log(table.toString(), LoggerLevel.INFO);

        return mergedProfiles;
    }
}
