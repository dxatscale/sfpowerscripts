import child_process = require("child_process");
import SFPLogger from "../utils/SFPLogger";
const Table = require("cli-table");

export default class AssignPermissionSetsImpl {
  constructor(
    private target_org: string,
    private permSets: string[],
    private project_directory: string,
    private packageLogger?: string
  ){}

  public exec() {

    // Expand alias into full username
    let username: string = this.target_org;
    let aliasList: string = child_process.execSync(
      `sfdx alias:list --json`,
      {
        cwd: this.project_directory,
        encoding: "utf8",
        stdio: ['pipe', 'pipe', 'inherit']
      }
    );

    let aliasListObj = JSON.parse(aliasList);
    if (aliasListObj.status === 0) {
      let aliasMatch = aliasListObj
        .result
        .find(
          (elem) => {
            return elem.alias === username;
          }
        );

      if (aliasMatch !== undefined) {
        username = aliasMatch.value;
      }
    } else {
      throw new Error(`Failed to retrieve list of username aliases`);
    }

    for (let permSet of this.permSets) {

      // Check whether permission set is assigned to username
      let queryResult: string = child_process.execSync(
        `sfdx force:data:soql:query -q "SELECT Id, PermissionSet.Name, Assignee.Username FROM PermissionSetAssignment WHERE Assignee.Username = '${username}'" -u ${username} --json`,
        {
          cwd: this.project_directory,
          encoding: "utf8",
          stdio: ['pipe', 'pipe', 'inherit']
        }
      );

      let queryResultObj = JSON.parse(queryResult);
      if (queryResultObj.status === 0) {
        let permSetAssignmentMatch = queryResultObj
          .result
          .records
          .find(
            (record) => {
              return record.PermissionSet.Name === permSet;
            }
          );
        if ( permSetAssignmentMatch !== undefined) {
          // Skip assignment of permission set
          SFPLogger.log(`${permSet} is already assigned to ${username}`, null, this.packageLogger);
          continue;
        }
      } else {
        throw new Error(`Failed to query permission set assignments for ${username}`);
      }

      let permsetAssignmentJson: string = child_process.execSync(
        `npx sfdx force:user:permset:assign -n ${permSet} -u ${username} --json`,
        {
          cwd: this.project_directory,
          encoding: "utf8",
          stdio: ['pipe', 'pipe', 'inherit']
        }
      );

      let permsetAssignment = JSON.parse(permsetAssignmentJson);

      if (permsetAssignment.status === 0) {
        SFPLogger.log(`Permsets Assigned`);
        this.printPermsetAssignments(permsetAssignment.result.successes);
      } else {
        SFPLogger.log(`Failures`);
        this.printPermsetAssignments(permsetAssignment.result.failures);
      }
    }
  }

  private printPermsetAssignments(
    assignments: { name: string; value: string }[]
  ) {
    let table = new Table({
      head: ["Username", "Permission Set Assignment"]
    });

    assignments.forEach((assignment) => {
      table.push([
        assignment.name,
        assignment.value
      ]);
    });

    SFPLogger.log(table.toString(), null, this.packageLogger);
  }
}
