import { Connection } from '@salesforce/core';
import { Logger } from '@dxatscale/sfp-logger';
import AssignPermissionSetsImpl from './AssignPermissionSetsImpl';

export default class AssignPermissionSets {
    static async applyPermsets(permsets: string[], conn: Connection, sourceDirectory: string, logger: Logger) {
        let assignPermissionSetsImpl: AssignPermissionSetsImpl = new AssignPermissionSetsImpl(
            conn,
            permsets,
            sourceDirectory,
            logger
        );

        let results = await assignPermissionSetsImpl.exec();
        if (results.failedAssignments.length > 0) throw new Error('Unable to assign permsets');
    }
}
