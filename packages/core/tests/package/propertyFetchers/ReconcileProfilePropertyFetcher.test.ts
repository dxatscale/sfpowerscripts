import { jest, expect } from '@jest/globals';
import { Logger } from '@dxatscale/sfp-logger';
import PropertyFetcher from '../../../src/package/propertyFetchers/PropertyFetcher';
import ReconcileProfilePropertyFetcher from '../../../src/package/propertyFetchers/ReconcileProfilePropertyFetcher';
import SfpPackage from '../../../src/package/SfpPackage';
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
            let propertyFetchers: PropertyFetcher[] = [new ReconcileProfilePropertyFetcher()];

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

describe('Given a package descriptor with reconcileProfiles', () => {
    it('Should set reconcileProfiles property in SfpPackage', async () => {
        let reconcileProfilePropertyFetcher: ReconcileProfilePropertyFetcher = new ReconcileProfilePropertyFetcher();
        let sfpPackage: SfpPackage = await SfpPackageBuilder.buildPackageFromProjectDirectory(null, null, null);
        reconcileProfilePropertyFetcher.getSfpowerscriptsProperties(sfpPackage);
        expect(sfpPackage.reconcileProfiles).toBe(false);
    });
});

const packageDescriptor: any = {
    path: 'force-app',
    package: 'force-app',
    versionNumber: '1.0.0.NEXT',
    reconcileProfiles: false,
};
