import { Connection } from "@salesforce/core";
import QueryHelper from "../../queryHelper/QueryHelper";


const query =
  'SELECT Id,Name, Description, NamespacePrefix, ContainerOptions, IsOrgDependent ' +
  'FROM Package2 ' +
  'WHERE IsDeprecated != true ' +
  'ORDER BY NamespacePrefix, Name';


export default class PackageFetcher
{

  
  constructor(
    private conn: Connection
  ) {}

  public async listAllPackages()
  {
    let records = await QueryHelper.query<any>(query, this.conn, true);
    records.forEach(record => {
      record.IsOrgDependent = record.ContainerOptions === 'Managed' ? 'N/A' : record.IsOrgDependent === true ? 'Yes' : 'No';
    });
  
    return records;
  }
}