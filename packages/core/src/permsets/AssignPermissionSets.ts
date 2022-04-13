import { Connection } from '@salesforce/core';
import child_process = require('child_process');
import SFPLogger, { Logger, LoggerLevel } from '../logger/SFPLogger';
import PermissionSetFetcher from './PermissionSetFetcher';
const Table = require('cli-table');

export default class AssignPermissionSets {
    constructor(
        private conn: Connection,
        private permSets: string[],
        private project_directory: string,
        private packageLogger: Logger
    ) {}

    public async exec(): Promise<{
        successfullAssignments: {
            username: string;
            permset: string;
        }[];
        failedAssignments: {
            username: string;
            permset: string;
        }[];
    }> {
        let permsetListImpl: PermissionSetFetcher = new PermissionSetFetcher(this.conn.getUsername(), this.conn);
        let assignedPermSets = await permsetListImpl.fetchAllPermsetAssignment();

        let failedAssignments: {
            username: string;
            permset: string;
        }[] = new Array();
        let successfullAssignments: {
            username: string;
            permset: string;
        }[] = new Array();

        for (let permSet of this.permSets) {
            let permSetAssignmentMatch = assignedPermSets.find((record) => {
                return record.PermissionSet.Name === permSet;
            });

            if (permSetAssignmentMatch !== undefined) {
                // Treat permsets that have already been assigned as successes
                successfullAssignments.push({ username: this.conn.getUsername(), permset: permSet });
                continue;
            }

            try {
                let permsetAssignmentJson: string = child_process.execSync(
                    `sfdx force:user:permset:assign -n ${permSet} -u ${this.conn.getUsername()} --json`,
                    {
                        cwd: this.project_directory,
                        encoding: 'utf8',
                        stdio: ['pipe', 'pipe', 'inherit'],
                    }
                );

                let permsetAssignment = JSON.parse(permsetAssignmentJson);
                if (permsetAssignment.status === 0)
                    successfullAssignments.push({ username: this.conn.getUsername(), permset: permSet });
                else failedAssignments.push({ username: this.conn.getUsername(), permset: permSet });
            } catch (err) {
                failedAssignments.push({ username: this.conn.getUsername(), permset: permSet });
            }
        }

        if (successfullAssignments.length > 0) {
            SFPLogger.log('Successful PermSet Assignments:', LoggerLevel.INFO, this.packageLogger);
            this.printPermsetAssignments(successfullAssignments);
        }

        if (failedAssignments.length > 0) {
            SFPLogger.log('Failed PermSet Assignments', LoggerLevel.INFO, this.packageLogger);
            this.printPermsetAssignments(failedAssignments);
        }

        return { successfullAssignments, failedAssignments };
    }

    private printPermsetAssignments(assignments: { username: string; permset: string }[]) {
        let table = new Table({
            head: ['Username', 'Permission Set Assignment'],
        });

        assignments.forEach((assignment) => {
            table.push([assignment.username, assignment.permset]);
        });

        SFPLogger.log(table.toString(), LoggerLevel.INFO, this.packageLogger);
    }
}
