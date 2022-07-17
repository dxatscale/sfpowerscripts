import { Connection } from '@salesforce/core';
import { Record, SaveResult } from 'jsforce';
import { isArray } from 'lodash';

const retry = require('async-retry');

export default class ObjectCRUDHelper {
    static async updateRecord(conn: Connection, sObject: string, record: Record): Promise<string> {
        return retry(
            async (bail) => {
                let result = await conn.update(sObject, record);
                if (isArray(result)) {
                    let isAllRecordsSucceeded = true;
                    for (const individualResult of result) {
                        if (!individualResult.success) {
                            isAllRecordsSucceeded = false;
                        }
                    }
                    if (isAllRecordsSucceeded) return 'All records updated';
                    else throw new Error('Some records have been failed to update');
                } else if (result.success) return result.id;
                else bail();
            },
            { retries: 3, minTimeout: 2000 }
        );
    }

    static async createRecord(conn: Connection, sObject: string, record: Record): Promise<string> {
        return retry(
            async (bail) => {
                let result = await conn.create(sObject, record);
                if (result.success) return result.id;
                else bail();
            },
            { retries: 3, minTimeout: 2000 }
        );
    }
}
