import { Connection } from '@salesforce/core';
import { Record } from 'jsforce';
const retry = require('async-retry');

export default class ObjectCRUDHelper {
    static async updateRecord<T>(conn: Connection, sObject: string, record: Record<T>): Promise<string> {
        return retry(
            async (bail) => {
                let result = await conn.sobject(sObject).update(record);
                if (result.success) return result.id;
                else bail();
            },
            { retries: 3, minTimeout: 2000 }
        );
    }

    static async createRecord<T>(conn: Connection, sObject: string, record: Record<T>): Promise<string> {
        return retry(
            async (bail) => {
                let result = await conn.sobject(sObject).create(record);
                if (result.success) return result.id;
                else bail();
            },
            { retries: 3, minTimeout: 2000 }
        );
    }
}
