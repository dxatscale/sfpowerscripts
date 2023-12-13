import { jest, expect } from '@jest/globals';
const fs = require('fs-extra');
import ApexTestSuite from '../../../src/core/apextest/ApexTestSuite';
import * as globSync from 'glob';



describe('Provided an apex test suite from a source directory', () => {
    it('should return all the apexclasses', () => {


        jest.spyOn(globSync, 'globSync').mockImplementationOnce((pattern: string | string[], options: any) => {
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

        const resultTestClasses = new Array<string>();
        resultTestClasses.push(`AccountAccountRelationTriggerTest`);
        resultTestClasses.push(`AccountContactRelationTriggerTest`);
        resultTestClasses.push(`AccountTeamMemberTriggerTest`);
        resultTestClasses.push(`AccountTriggerTest`);
        resultTestClasses.push(`ContactTriggerTest`);

        const apexTestSuite = new ApexTestSuite(`dir`, `test`);
        expect(apexTestSuite.getConstituentClasses()).resolves.toStrictEqual(resultTestClasses);
    });

    it('should throw an error if apex test suite is not avaiable in the directory', async () => {
       
        jest.spyOn(globSync, 'globSync').mockImplementationOnce((pattern: string | string[], options: any) => {
            return  [];
        });



        const apexTestSuite = new ApexTestSuite(`dir`, `test`);

        expect(apexTestSuite.getConstituentClasses()).rejects.toThrowError();
    });

    it('should return apexclass even if there is only one', () => {

        jest.spyOn(globSync, 'globSync').mockImplementationOnce((pattern: string | string[], options: any) => {
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

        const resultTestClasses = new Array<string>();
        resultTestClasses.push(`AccountAccountRelationTriggerTest`);

        const apexTestSuite = new ApexTestSuite(`dir`, `test`);
        expect(apexTestSuite.getConstituentClasses()).resolves.toStrictEqual(resultTestClasses);
    });
});
