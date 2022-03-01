import { Connection, Org } from "@salesforce/core";
import SFPLogger, { Logger, LoggerLevel } from "../../logger/SFPLogger";
import QueryHelper from "../../queryHelper/QueryHelper";
import { chunkArray } from "../../utils/ChunkArray";

const CODECOVAGG_QUERY = `SELECT Id FROM ApexCodeCoverageAggregate`;
const APEXTESTRESULT_QUERY = `SELECT Id FROM ApexTestResult`;

export default class ClearTestResults {
  private conn: Connection;

  public constructor(private org: Org, private logger: Logger) {}
  /**
   *  Clear coverage and test results
   */
  public async clear() {
    this.conn = this.org.getConnection();

    SFPLogger.log(
      `Clearing Existing Coverage and Test Results`,
      LoggerLevel.INFO,
      this.logger
    );

  
      SFPLogger.log(
        `Clearing Coverage Results`,
        LoggerLevel.DEBUG,
        this.logger
      );
      let codeCovAgg = await QueryHelper.query(
        CODECOVAGG_QUERY,
        this.conn,
        true
      );
      await this.deleteRecords("ApexCodeCoverageAggregate", codeCovAgg);
      SFPLogger.log(`Cleared Coverage Results`, LoggerLevel.DEBUG, this.logger);

      SFPLogger.log(`Clearing Test Results`, LoggerLevel.DEBUG, this.logger);
      let testResults = await QueryHelper.query(
        APEXTESTRESULT_QUERY,
        this.conn,
        true
      );
      await this.deleteRecords("ApexTestResult", testResults);
      SFPLogger.log(`Cleared Test Results`, LoggerLevel.DEBUG, this.logger);

      SFPLogger.log(
        `Clearing Existing Coverage and Test Results`,
        LoggerLevel.INFO,
        this.logger
      );
      return true;
   
  }

  private async deleteRecords(objectType: string, records: any[]) {
    if (records && records.length > 0) {
      let idsList: string[] = records.map((elem) => elem.Id);
      let errors = [];
      for (let idsTodelete of chunkArray(2000, idsList)) {
        const deleteResults: any = await this.conn.tooling.destroy(
          objectType,
          idsTodelete
        );
        deleteResults.forEach((elem) => {
          if (!elem.success) {
            errors = errors.concat(elem.errors);
          }
        });
      }

      if (errors.length > 0) {
        throw new Error(JSON.stringify(errors));
      }
    }
  }
}
