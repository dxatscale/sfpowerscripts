import { Connection } from '@salesforce/core';
import { Logger } from '../../logger/SFPLogger';
import AssignPermissionSets from '../../permsets/AssignPermissionSets';

export default class PackageInstallationHelpers {
    static async applyPermsets(permsets: string[], conn: Connection, sourceDirectory: string, logger: Logger) {
        let assignPermissionSetsImpl: AssignPermissionSets = new AssignPermissionSets(
            conn,
            permsets,
            sourceDirectory,
            logger
        );

        let results = await assignPermissionSetsImpl.exec();
        if (results.failedAssignments.length > 0) throw new Error('Unable to assign permsets');
    }
}
