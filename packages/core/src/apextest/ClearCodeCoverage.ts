import { Connection, Org } from '@salesforce/core';
import SFPLogger, { Logger, LoggerLevel } from '@dxatscale/sfp-logger';
import QueryHelper from '../queryHelper/QueryHelper';
import { chunkArray } from '../utils/ChunkArray';
const CODECOV_AGGREGATE_QUERY = `SELECT Id FROM ApexCodeCoverageAggregate`;
const APEX_TEST_RESULT_QUERY = `SELECT Id FROM ApexTestResult`;
import { delay } from '../utils/Delay';

export default class ClearTestResults {
    private conn: Connection;

    public constructor(private org: Org, private logger: Logger) {}
    /**
     *  Clear coverage and test results
     */
    public async clear() {
        this.conn = this.org.getConnection();

        SFPLogger.log(`Clearing Coverage Results`, LoggerLevel.DEBUG, this.logger);
        let codeCoverageAggregate = await QueryHelper.query(CODECOV_AGGREGATE_QUERY, this.conn, true);
        await this.deleteRecords('ApexCodeCoverageAggregate', codeCoverageAggregate);
        SFPLogger.log(`Cleared Coverage Results`, LoggerLevel.DEBUG, this.logger);

        SFPLogger.log(`Clearing Test Results`, LoggerLevel.DEBUG, this.logger);
        let testResults = await QueryHelper.query(APEX_TEST_RESULT_QUERY, this.conn, true);
        await this.deleteRecords('ApexTestResult', testResults);
        SFPLogger.log(`Cleared Test Results`, LoggerLevel.DEBUG, this.logger);

        SFPLogger.log(`Cleared Existing Coverage and Test Results`, LoggerLevel.INFO, this.logger);

        //allow org to catchup
        await delay(10000);
    }

    private async deleteRecords(objectType: string, records: any[]) {
        if (records && records.length > 0) {
            let idsList: string[] = records.map((elem) => elem.Id);
            let errors = [];
            for (let idsToDelete of chunkArray(2000, idsList)) {
                const deleteResults: any = await this.conn.tooling.destroy(objectType, idsToDelete);
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
