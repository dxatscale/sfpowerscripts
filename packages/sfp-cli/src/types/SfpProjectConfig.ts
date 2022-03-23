import { WorkItem } from './WorkItem';

export class SfpProjectConfig {
    name?: string;
    defaultBranch?: string;
    defaultDevHub?: string;
    defaultPool?: string;
    workItems?: any;
    repoProvider?: string;

    public getWorkItemGivenBranch(branch: string): WorkItem {
        if (this.workItems) {
            for (const id of Object.keys(this.workItems)) {
                if (this.workItems[id]['branch']?.toLowerCase() === branch.toLowerCase()) return this.workItems[id];
            }
        } else return undefined;
    }

    /**
     * De-serialize JSON object into SfpProjectConfig
     * @param jsonObj
     * @returns
     */
    static toInstance(jsonObj: any): SfpProjectConfig {
        if (typeof jsonObj !== 'object') throw new Error('toInstance takes an object as an input');

        const sfpProjectConfig = new SfpProjectConfig();
        for (var propName in jsonObj) {
            sfpProjectConfig[propName] = jsonObj[propName];
        }
        return sfpProjectConfig;
    }

    /**
     * Checks whether instance of SfpProjectConfig is valid
     * @returns
     */
    public static isValid(sfpProjectConfig: SfpProjectConfig): boolean {
        return !!sfpProjectConfig.name;
    }
}
