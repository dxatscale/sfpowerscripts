
const fs = require('fs-extra');
import path from 'path';
import xml2json from '../utils/xml2json';
import { globSync } from 'glob';

export default class ApexTestSuite {
    public constructor(private sourceDir: string, private suiteName: string) {}

    public async getConstituentClasses(): Promise<string[]> {
        let testSuitePaths: string[] = globSync(`**${this.suiteName}.testSuite-meta.xml`, {
            cwd: this.sourceDir,
            absolute: true,
        });

        console.log('testSuitePaths',testSuitePaths);

        if (!testSuitePaths[0]) throw new Error(`Apex Test Suite ${this.suiteName} not found`);

        let apex_test_suite: any = await xml2json(fs.readFileSync(path.resolve(testSuitePaths[0])));

        if (Array.isArray(apex_test_suite.ApexTestSuite.testClassName)) {
            return apex_test_suite.ApexTestSuite.testClassName;
        } else {
            let testClassess = new Array<string>();
            testClassess.push(apex_test_suite.ApexTestSuite.testClassName);
            return testClassess;
        }
    }
}
