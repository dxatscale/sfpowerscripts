import PackageTestCoverage from '../../../src/package/coverage/PackageTestCoverage';
import { jest, expect } from '@jest/globals';
import { ConsoleLogger, Logger } from '@dxatscale/sfp-logger';
import ApexClassFetcher from '../../../src/apex/ApexClassFetcher';
import ApexTriggerFetcher from '../../../src/apex/ApexTriggerFetcher';
import ApexCodeCoverageAggregateFetcher from '../../../src/apex/coverage/ApexCodeCoverageAggregateFetcher';

import { Org } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import SfpPackage, { PackageType } from '../../../src/package/SfpPackage';
import SfpPackageBuilder from '../../../src/package/SfpPackageBuilder';
const $$ = testSetup();

let packageType = PackageType.Unlocked;



jest.mock('../../../src/package/SfpPackageBuilder', () => {
    class SfpPackageBuilder {

        public assignPermSetsPreDeployment?: string[];
        public assignPermSetsPostDeployment?: string[];

        public static async buildPackageFromProjectDirectory(
            logger: Logger,
            projectDirectory: string,
            sfdx_package: string
        ) {
          

            let sfpPackage: SfpPackage = new SfpPackage();
             sfpPackage.apexClassWithOutTestClasses =  new Array<string>('CustomerServices', 'MarketServices');
             sfpPackage.triggers = new Array<string>('AccountTrigger');
             sfpPackage.packageType = packageType;
            return sfpPackage;
        }
    }

    return SfpPackageBuilder;
});



const setupConnection = async () => {
    const testData = new MockTestOrgData();

    $$.setConfigStubContents('AuthInfoConfig', {
        contents: await testData.getConfig(),
    });

    return (await Org.create({ aliasOrUsername: testData.username })).getConnection();
};

describe('Given a sfpowerscripts package and code coverage report, a package coverage calculator', () => {
    it('should be able to provide the coverage of a provided unlocked package', async () => {
        const conn = await setupConnection();

        let sfpPackage: SfpPackage = await SfpPackageBuilder.buildPackageFromProjectDirectory(null, 'es-base-code', null, null);
        let packageTestCoverage: PackageTestCoverage = new PackageTestCoverage(
            sfpPackage,
            succesfulTestCoverage,
            new ConsoleLogger(),
            conn
        );
        expect(await packageTestCoverage.getCurrentPackageTestCoverage()).toBe(89);
    });

    it('should able to validate whether the coverage of unlocked  package is above a certain threshold', async () => {
        const conn = await setupConnection();

        let sfpPackage: SfpPackage = await SfpPackageBuilder.buildPackageFromProjectDirectory(null, 'es-base-code', null, null);
        let packageTestCoverage: PackageTestCoverage = new PackageTestCoverage(
            sfpPackage,
            succesfulTestCoverage,
            new ConsoleLogger(),
            conn
        );
        let requiredCoverage = 80;
        let result = await packageTestCoverage.validateTestCoverage(requiredCoverage);
        expect(result.result).toBe(true);
        expect(result.packageTestCoverage).toBe(89);
        expect(result.message).toStrictEqual(`Package overall coverage is greater than ${requiredCoverage}%`);
        expect(result.classesCovered).toStrictEqual([
            { name: 'CustomerServices', coveredPercent: 87.09677419354838 },
            { name: 'MarketServices', coveredPercent: 100 },
            { name: 'AccountTrigger', coveredPercent: 100 },
        ]);
        expect(result.classesWithInvalidCoverage).toBeUndefined();
    });

    it('should able to validate whether the coverage of unlocked  package is above mandatory threshold', async () => {
        const conn = await setupConnection();

        let sfpPackage: SfpPackage = await SfpPackageBuilder.buildPackageFromProjectDirectory(null, 'es-base-code', null, null);
        let packageTestCoverage: PackageTestCoverage = new PackageTestCoverage(
            sfpPackage,
            succesfulTestCoverage,
            new ConsoleLogger(),
            conn
        );
        let requiredCoverage = 75;
        let result = await packageTestCoverage.validateTestCoverage();
        expect(result.result).toBe(true);
        expect(result.packageTestCoverage).toBe(89);
        expect(result.message).toStrictEqual(`Package overall coverage is greater than ${requiredCoverage}%`);
        expect(result.classesCovered).toStrictEqual([
            { name: 'CustomerServices', coveredPercent: 87.09677419354838 },
            { name: 'MarketServices', coveredPercent: 100 },
            { name: 'AccountTrigger', coveredPercent: 100 },
        ]);
        expect(result.classesWithInvalidCoverage).toBeUndefined();
    });

    it('should be able to provide the coverage of a provided source package', async () => {
        const conn = await setupConnection();

        packageType = PackageType.Source;
        let sfpPackage: SfpPackage = await SfpPackageBuilder.buildPackageFromProjectDirectory(null, 'es-base-code', null, null);
        let packageTestCoverage: PackageTestCoverage = new PackageTestCoverage(
            sfpPackage,
            succesfulTestCoverage,
            new ConsoleLogger(),
            conn
        );
        expect(await packageTestCoverage.getCurrentPackageTestCoverage()).toBe(89);
    });

    it('should able to validate whether the coverage of source  package is above a certain threshold', async () => {
        const conn = await setupConnection();

        packageType = PackageType.Source;
        let sfpPackage: SfpPackage = await SfpPackageBuilder.buildPackageFromProjectDirectory(null, 'es-base-code', null, null);
        let packageTestCoverage: PackageTestCoverage = new PackageTestCoverage(
            sfpPackage,
            succesfulTestCoverage,
            new ConsoleLogger(),
            conn
        );
        let requiredCoverage = 80;
        let result = await packageTestCoverage.validateTestCoverage(requiredCoverage);
        expect(result.result).toBe(true);
        expect(result.packageTestCoverage).toBe(89);
        expect(result.message).toStrictEqual(`Individidual coverage of classes is greater than ${requiredCoverage}%`);
        expect(result.classesCovered).toStrictEqual([
            { name: 'CustomerServices', coveredPercent: 87.09677419354838 },
            { name: 'MarketServices', coveredPercent: 100 },
            { name: 'AccountTrigger', coveredPercent: 100 },
        ]);
        expect(result.classesWithInvalidCoverage).toBeUndefined();
    });

    it('should able to validate whether the coverage of source  package is above mandatory threshold', async () => {
        const conn = await setupConnection();

        packageType = PackageType.Source;
        let sfpPackage: SfpPackage = await SfpPackageBuilder.buildPackageFromProjectDirectory(null, 'es-base-code', null, null);
        let packageTestCoverage: PackageTestCoverage = new PackageTestCoverage(
            sfpPackage,
            succesfulTestCoverage,
            new ConsoleLogger(),
            conn
        );
        let requiredCoverage = 75;
        let result = await packageTestCoverage.validateTestCoverage();
        expect(result.result).toBe(true);
        expect(result.packageTestCoverage).toBe(89);
        expect(result.message).toStrictEqual(`Individidual coverage of classes is greater than ${requiredCoverage}%`);
        expect(result.classesCovered).toStrictEqual([
            { name: 'CustomerServices', coveredPercent: 87.09677419354838 },
            { name: 'MarketServices', coveredPercent: 100 },
            { name: 'AccountTrigger', coveredPercent: 100 },
        ]);
        expect(result.classesWithInvalidCoverage).toBeUndefined();
    });

    it('should account for untouched classes and triggers when calculating package test coverage', async () => {
        const conn = await setupConnection();

        jest.spyOn(ApexClassFetcher.prototype, 'fetchApexClassByName').mockResolvedValue([
            { Id: '01p0w000001n1SfAAI', Name: 'MarketServices' },
        ]);
        jest.spyOn(ApexTriggerFetcher.prototype, 'fetchApexTriggerByName').mockResolvedValue([
            { Id: '01p2O000003s9qcQAA', Name: 'AccountTrigger' },
        ]);
        jest.spyOn(ApexCodeCoverageAggregateFetcher.prototype, 'fetchACCAById').mockResolvedValue([
            { ApexClassOrTriggerId: '01p0w000001n1SfAAI', NumLinesCovered: 0, NumLinesUncovered: 3, Coverage: {} },
            { ApexClassOrTriggerId: '01p2O000003s9qcQAA', NumLinesCovered: 0, NumLinesUncovered: 4, Coverage: {} },
        ]);

        packageType = PackageType.Source;
        let sfpPackage: SfpPackage = await SfpPackageBuilder.buildPackageFromProjectDirectory(null, 'es-base-code', null, null);
        let packageTestCoverage: PackageTestCoverage = new PackageTestCoverage(
            sfpPackage,
            testCoverageWithUntouchedClasses,
            new ConsoleLogger(),
            conn
        );
        let result = await packageTestCoverage.validateTestCoverage();

        expect(result.result).toBe(false);
        expect(result.packageTestCoverage).toBe(71);
        expect(result.classesCovered).toEqual([
            { name: 'CustomerServices', coveredPercent: 87.09677419354838 },
            { name: 'MarketServices', coveredPercent: 0 },
            { name: 'AccountTrigger', coveredPercent: 0 },
        ]);
        expect(result.classesWithInvalidCoverage).toEqual([
            { name: 'MarketServices', coveredPercent: 0 },
            { name: 'AccountTrigger', coveredPercent: 0 },
        ]);
    });
});

let succesfulTestCoverage = [
    {
        id: '01p0w000001n1SdAAI',
        name: 'CustomerServices',
        totalLines: 31,
        lines: {
            '3': 1,
            '4': 1,
            '5': 1,
            '13': 1,
            '15': 1,
            '16': 1,
            '17': 1,
            '18': 1,
            '19': 1,
            '20': 1,
            '21': 1,
            '22': 1,
            '25': 1,
            '31': 1,
            '34': 1,
            '37': 1,
            '40': 1,
            '43': 0,
            '46': 0,
            '49': 1,
            '57': 1,
            '58': 1,
            '59': 1,
            '60': 1,
            '61': 1,
            '62': 1,
            '63': 1,
            '64': 1,
            '65': 0,
            '66': 1,
            '67': 0,
        },
        totalCovered: 27,
        coveredPercent: 87.09677419354838,
    },
    {
        id: '01p0w000001n1SfAAI',
        name: 'MarketServices',
        totalLines: 3,
        lines: {
            '3': 1,
            '4': 1,
            '16': 1,
        },
        totalCovered: 3,
        coveredPercent: 100,
    },
    {
        id: '01p2O000003s9qcQAA',
        name: 'AccountTrigger',
        totalLines: 4,
        lines: {
            '3': 1,
            '5': 1,
            '10': 1,
            '11': 1,
        },
        totalCovered: 4,
        coveredPercent: 100,
    },
];

const testCoverageWithUntouchedClasses = [
    {
        id: '01p0w000001n1SdAAI',
        name: 'CustomerServices',
        totalLines: 31,
        lines: {
            '3': 1,
            '4': 1,
            '5': 1,
            '13': 1,
            '15': 1,
            '16': 1,
            '17': 1,
            '18': 1,
            '19': 1,
            '20': 1,
            '21': 1,
            '22': 1,
            '25': 1,
            '31': 1,
            '34': 1,
            '37': 1,
            '40': 1,
            '43': 0,
            '46': 0,
            '49': 1,
            '57': 1,
            '58': 1,
            '59': 1,
            '60': 1,
            '61': 1,
            '62': 1,
            '63': 1,
            '64': 1,
            '65': 0,
            '66': 1,
            '67': 0,
        },
        totalCovered: 27,
        coveredPercent: 87.09677419354838,
    },
];
