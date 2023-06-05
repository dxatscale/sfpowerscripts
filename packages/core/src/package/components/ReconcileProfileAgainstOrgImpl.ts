import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import { ZERO_BORDER_TABLE } from '../../display/TableConstants';
const Table = require('cli-table');
import ProfileReconcile from '@dxatscale/sfprofiles/lib/impl/source/profileReconcile';
import SFPOrg from '../../org/SFPOrg';
import path from 'path';
import { METADATA_INFO } from '../../metadata/MetadataInfo';

export default class ReconcileProfileAgainstOrgImpl {
    public constructor(private sfpOrg:SFPOrg, private project_directory: string, private logger: Logger) {}

    public async exec() {
       
        let result=[];
        try {
            let profileReconciler = new ProfileReconcile(this.sfpOrg);
            let reconcileProfiles = await profileReconciler.reconcile(
                [ this.project_directory],
                [],
                undefined
            );

            // Return an object to be displayed with --json

            reconcileProfiles.forEach((file) => {
                result.push({
                    state: 'Cleaned',
                    fullName: path.basename(file, METADATA_INFO.Profile.sourceExtension),
                    type: 'Profile',
                    path: path.relative(this.project_directory, file),
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
