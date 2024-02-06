
import { AnyJson } from '@salesforce/ts-types';
import poolListImpl from '../../core/scratchorg/pool/PoolListImpl';
import ScratchOrg from '../../core/scratchorg/ScratchOrg';
import SFPLogger, { LoggerLevel } from '@flxblio/sfp-logger';
import { Messages } from '@salesforce/core';
import SfpCommand from '../../SfpCommand';
import { Flags, ux } from '@oclif/core';
import { loglevel, orgApiVersionFlagSfdxStyle, targetdevhubusername } from '../../flags/sfdxflags';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@flxblio/sfp', 'scratchorg_poollist');

export default class List extends SfpCommand {
    public static description = messages.getMessage('commandDescription');

    protected static requiresDevhubUsername = true;
    public static enableJsonFlag = true
    
    public static examples = [
        `$ sfp pool:list -t core `,
        `$ sfp pool:list -t core -v devhub`,
        `$ sfp pool:list -t core -v devhub -m`,
        `$ sfp pool:list -t core -v devhub -m -a`,
    ];

    public static flags = {
        targetdevhubusername,
        'apiversion': orgApiVersionFlagSfdxStyle,
        tag: Flags.string({
            char: 't',
            description: messages.getMessage('tagDescription'),
            required: false,
        }),
        mypool: Flags.boolean({
            char: 'm',
            description: messages.getMessage('mypoolDescription'),
            required: false,
        }),
        allscratchorgs: Flags.boolean({
            char: 'a',
            description: messages.getMessage('allscratchorgsDescription'),
            required: false,
        }),
        loglevel
    };

    public async execute(): Promise<any> {
        await this.hubOrg.refreshAuth();
        const hubConn = this.hubOrg.getConnection();

        this.flags.apiversion = this.flags.apiversion || (await hubConn.retrieveMaxApiVersion());

        let listImpl = new poolListImpl(this.hubOrg, this.flags.tag, this.flags.allscratchorgs);

        let result = (await listImpl.execute()) as ScratchOrg[];

        if (!this.flags.mypool && result.length > 0) {
            result.forEach((element) => {
                delete element.password;
            });
        }

        let scratchOrgInuse = result.filter((element) => element.status === 'In use');
        let scratchOrgNotInuse = result.filter((element) => element.status === 'Available');
        let scratchOrgInProvision = result.filter((element) => element.status === 'Provisioning in progress');

        if (!this.flags.json) {
            if (result.length > 0) {
                ux.log(`======== Scratch org Details ========`);

                if (!this.flags.tag) {
                    ux.log(`List of all the pools in the org`);

                    this.logTagCount(result);
                    ux.log('===================================');
                }

                if (this.flags.allscratchorgs) {
                    ux.log(`Used Scratch Orgs in the pool: ${scratchOrgInuse.length}`);
                }
                ux.log(`Unused Scratch Orgs in the Pool : ${scratchOrgNotInuse.length} \n`);
                if (scratchOrgInProvision.length && scratchOrgInProvision.length > 0) {
                    ux.log(`Scratch Orgs being provisioned in the Pool : ${scratchOrgInProvision.length} \n`);
                }

                if (this.flags.mypool) {
                   // ux.table(result, {'tag':{}, 'orgId':{}, 'username':{}, 'password':{}, 'expiryDate':{}, 'status':{}, 'loginURL':{}});
                } else {
                    //ux.table(result, ['tag', 'orgId', 'username', 'expiryDate', 'status', 'loginURL']);
                }
            } else {
                SFPLogger.log(`No Scratch orgs available, time to create your pool.`, LoggerLevel.ERROR);
            }
        }

        let output = {
            total: scratchOrgInuse.length + scratchOrgNotInuse.length + scratchOrgInProvision.length,
            inuse: scratchOrgInuse.length,
            unused: scratchOrgNotInuse.length,
            inprovision: scratchOrgInProvision.length,
            scratchOrgDetails: result,
        };

        return output;
    }

    private logTagCount(result: ScratchOrg[]) {
        let tagCounts: any = result.reduce(function (obj, v) {
            obj[v.tag] = (obj[v.tag] || 0) + 1;
            return obj;
        }, {});

        let tagArray = new Array<any>();

        Object.keys(tagCounts).forEach(function (key) {
            tagArray.push({
                tag: key,
                count: tagCounts[key],
            });
        });

        ux.table(tagArray, {'tag':{}, 'count':{}});
    }
}
