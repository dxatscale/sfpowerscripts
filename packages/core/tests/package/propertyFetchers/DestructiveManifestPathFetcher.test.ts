import { jest, expect } from '@jest/globals';
import DestructiveManifestPathFetcher from '../../../src/package/propertyFetchers/DestructiveManifestPathFetcher';
import SfpPackage from '../../../src/package/SfpPackage';
const fs = require('fs-extra');
import { Logger } from '@dxatscale/sfp-logger';
import PropertyFetcher from '../../../src/package/propertyFetchers/PropertyFetcher';
import SfpPackageBuilder from '../../../src/package/SfpPackageBuilder';


jest.mock('../../../src/package/SfpPackageBuilder', () => {
    class SfpPackageBuilder {

        public assignPermSetsPreDeployment?: string[];
        public assignPermSetsPostDeployment?: string[];

        public static async buildPackageFromProjectDirectory(
            logger: Logger,
            projectDirectory: string,
            sfdx_package: string
        ) {
            let propertyFetchers: PropertyFetcher[] = [new DestructiveManifestPathFetcher()];

            let sfpPackage: SfpPackage = new SfpPackage();
             sfpPackage.packageDescriptor = packageDescriptor;
             for (const propertyFetcher of propertyFetchers) {
                await propertyFetcher.getSfpowerscriptsProperties(sfpPackage, logger);
            }

            return sfpPackage;
        }
    }

    return SfpPackageBuilder;
});


describe('Given a package descriptor with a destructiveChangePath', () => {
    beforeEach(() => {
        jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
            return destructiveChangesXml;
        });
    });

    it('Should set destructiveChangesPath property in SfpPackage', async () => {
        let destructiveManifestPathFetcher: DestructiveManifestPathFetcher = new DestructiveManifestPathFetcher();
        let sfpPackage: SfpPackage = await SfpPackageBuilder.buildPackageFromProjectDirectory(null, null, null);
        await destructiveManifestPathFetcher.getSfpowerscriptsProperties(sfpPackage);
        expect(sfpPackage.destructiveChangesPath).toBe('destructiveChanges.xml');
    });

    it('Should set destructiveChanges property in SfpPackage', async () => {
        let destructiveManifestPathFetcher: DestructiveManifestPathFetcher = new DestructiveManifestPathFetcher();
        let sfpPackage: SfpPackage = await  SfpPackageBuilder.buildPackageFromProjectDirectory(null, null, null);
        await destructiveManifestPathFetcher.getSfpowerscriptsProperties(sfpPackage);
        expect(sfpPackage.destructiveChanges).toStrictEqual(destructiveChanges);
    });
});

const packageDescriptor: any = {
    path: 'force-app',
    package: 'force-app',
    versionNumber: '1.0.0.NEXT',
    destructiveChangePath: 'destructiveChanges.xml',
};

const destructiveChangesXml: string = `
<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>MyCustomObject__c</members>
        <name>CustomObject</name>
    </types>
</Package>
`;
const destructiveChanges: any = {
    Package: {
        $: {
            xmlns: 'http://soap.sforce.com/2006/04/metadata',
        },
        types: {
            members: 'MyCustomObject__c',
            name: 'CustomObject',
        },
    },
};
