import { Connection } from '@salesforce/core';

export async function retrieveMetadata(types: any, connection: Connection): Promise<string[]> {
    const apiversion = await connection.retrieveMaxApiVersion();
    let toReturn: Promise<string[]> = new Promise<string[]>((resolve, reject) => {
        connection.metadata.list(types, apiversion).then(metadata => {
            let metadata_fullnames = [];
            for (let i = 0; i < metadata.length; i++) {
                metadata_fullnames.push(metadata[i].fullName);
            }
            resolve(metadata_fullnames);
        }).catch(err => {
            return reject(err);
        });
    });

    return toReturn;
}
