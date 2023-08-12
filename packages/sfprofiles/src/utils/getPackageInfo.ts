
import { SfProjectJson } from '@salesforce/core';
import { JsonArray } from '@salesforce/ts-types';

//Returns the info about a requested package
export function getPackageInfo(packageJson: SfProjectJson, packageName: string) {
    //Find the default package or passed package as the parameter
    const packageDirectories = (packageJson.get('packageDirectories') as JsonArray) || [];
    let packageInfo;
    if (packageName) {
        packageInfo = packageDirectories.filter((it) => {
            return it['package'] === packageName;
        })[0];

        if (packageInfo == undefined) {
            throw new Error('Invalid Package');
        }
    } else throw new Error('Package Name is empty');
    return packageInfo;
}

//Returns the info about a requested package
export function getDefaultPackageInfo(packageJson: SfProjectJson) {
    //Find the default package or passed package as the parameter
    const packageDirectories = (packageJson.get('packageDirectories') as JsonArray) || [];
    let packageInfo;

    packageInfo = packageDirectories.filter((it) => {
        return it['default'] == true;
    })[0];

    if (packageInfo == undefined) {
        throw new Error('Default Package not found');
    }

    return packageInfo;
}
