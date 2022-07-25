import IndividualClassCoverage from '../../src/apex/coverage/IndividualClassCoverage';
import { expect } from '@jest/globals';
import { ConsoleLogger } from '@dxatscale/sfp-logger';

describe('Given a test coverage report', () => {
    it('should be able to get a list of all classes and its test coverage', () => {
        let individualClasCoverage: IndividualClassCoverage = new IndividualClassCoverage(
            testCoverage,
            new ConsoleLogger()
        );
        let expectedValue = [
            { name: 'CustomerServices', coveredPercent: 87 },
            { name: 'MarketServices', coveredPercent: 100 },
            { name: 'ReservationManagerController', coveredPercent: 72 },
            { name: 'ReservationManager', coveredPercent: 93 },
        ];
        expect(individualClasCoverage.getIndividualClassCoverage()).toEqual(expectedValue);
    });

    it('given a coverage threshold, provide a list of classes that do not satisfy the threshold', () => {
        let individualClasCoverage: IndividualClassCoverage = new IndividualClassCoverage(
            testCoverage,
            new ConsoleLogger()
        );
        let validationResult = individualClasCoverage.validateIndividualClassCoverage(
            individualClasCoverage.getIndividualClassCoverage(),
            75
        );
        expect(validationResult.classesWithInvalidCoverage).toContainEqual({
            name: 'ReservationManagerController',
            coveredPercent: 72,
        });
    });
});

let testCoverage = [
    {
        id: '01p0w000001qr8HAAQ',
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
        coveredPercent: 87,
    },
    {
        id: '01p0w000001qr8JAAQ',
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
        id: '01p0w000001qr8NAAQ',
        name: 'ReservationManagerController',
        totalLines: 32,
        lines: {
            '4': 1,
            '7': 1,
            '8': 1,
            '17': 1,
            '22': 1,
            '23': 1,
            '25': 1,
            '26': 1,
            '27': 1,
            '28': 1,
            '29': 1,
            '30': 1,
            '31': 1,
            '32': 1,
            '33': 1,
            '34': 1,
            '35': 1,
            '36': 1,
            '37': 1,
            '39': 1,
            '41': 1,
            '42': 0,
            '43': 0,
            '44': 0,
            '45': 0,
            '46': 0,
            '47': 0,
            '48': 0,
            '50': 0,
            '52': 0,
            '56': 1,
            '57': 1,
        },
        totalCovered: 23,
        coveredPercent: 72,
    },
    {
        id: '01p0w000001qr8MAAQ',
        name: 'ReservationManager',
        totalLines: 28,
        lines: {
            '3': 1,
            '6': 1,
            '7': 1,
            '8': 1,
            '9': 1,
            '10': 1,
            '12': 1,
            '13': 1,
            '15': 1,
            '20': 1,
            '24': 1,
            '25': 1,
            '26': 1,
            '27': 1,
            '29': 1,
            '30': 1,
            '31': 1,
            '34': 1,
            '35': 1,
            '36': 1,
            '37': 1,
            '39': 1,
            '40': 1,
            '41': 1,
            '42': 1,
            '43': 0,
            '44': 0,
            '48': 1,
        },
        totalCovered: 26,
        coveredPercent: 93,
    },
];
