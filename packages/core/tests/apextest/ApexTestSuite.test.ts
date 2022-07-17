import { jest, expect } from '@jest/globals';
const fs = require('fs-extra');
import ApexTestSuite from '../../src/apextest/ApexTestSuite';
const glob = require('glob');

describe('Provided an apex test suite from a source directory', () => {
    it('should return all the apexclasses', () => {
        const globMock = jest.spyOn(glob, 'sync');
        globMock.mockImplementation(() => {
            return new Array('/path/to/test.testSuite-meta.xml');
        });

        const fsReadMock = jest.spyOn(fs, 'readFileSync');
        fsReadMock.mockImplementationOnce(() => {
            return `
        <?xml version="1.0" encoding="UTF-8"?>
        <ApexTestSuite xmlns="http://soap.sforce.com/2006/04/metadata">
             <testClassName>AccountAccountRelationTriggerTest</testClassName>
             <testClassName>AccountContactRelationTriggerTest</testClassName>
            <testClassName>AccountTeamMemberTriggerTest</testClassName>
            <testClassName>AccountTriggerTest</testClassName>
           <testClassName>ContactTriggerTest</testClassName>
       </ApexTestSuite>
        `;
        });

        let resultTestClasses = new Array<string>();
        resultTestClasses.push(`AccountAccountRelationTriggerTest`);
        resultTestClasses.push(`AccountContactRelationTriggerTest`);
        resultTestClasses.push(`AccountTeamMemberTriggerTest`);
        resultTestClasses.push(`AccountTriggerTest`);
        resultTestClasses.push(`ContactTriggerTest`);

        let apexTestSuite = new ApexTestSuite(`dir`, `test`);
        expect(apexTestSuite.getConstituentClasses()).resolves.toStrictEqual(resultTestClasses);
    });

    it('should throw an error if apex test suite is not avaiable in the directory', async () => {
        const globMock = jest.spyOn(glob, 'sync');
        globMock.mockImplementation(() => {
            return [];
        });

        let apexTestSuite = new ApexTestSuite(`dir`, `test`);

        expect(apexTestSuite.getConstituentClasses()).rejects.toThrowError();
    });

    it('should return apexclass even if there is only one', () => {
        const globMock = jest.spyOn(glob, 'sync');
        globMock.mockImplementation(() => {
            return new Array('/path/to/test.testSuite-meta.xml');
        });

        const fsReadMock = jest.spyOn(fs, 'readFileSync');
        fsReadMock.mockImplementationOnce(() => {
            return `
      <?xml version="1.0" encoding="UTF-8"?>
      <ApexTestSuite xmlns="http://soap.sforce.com/2006/04/metadata">
           <testClassName>AccountAccountRelationTriggerTest</testClassName>
     </ApexTestSuite>
      `;
        });

        let resultTestClasses = new Array<string>();
        resultTestClasses.push(`AccountAccountRelationTriggerTest`);

        let apexTestSuite = new ApexTestSuite(`dir`, `test`);
        expect(apexTestSuite.getConstituentClasses()).resolves.toStrictEqual(resultTestClasses);
    });
});
