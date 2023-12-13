import { jest, expect } from '@jest/globals';
import { Logger } from '@flxblio/sfp-logger';
import PropertyFetcher from '../../../../src/core/package/propertyFetchers/PropertyFetcher';
import ReconcileProfilePropertyFetcher from '../../../../src/core/package/propertyFetchers/ReconcileProfilePropertyFetcher';
import SfpPackage from '../../../../src/core/package/SfpPackage';
import SfpPackageBuilder from '../../../../src/core/package/SfpPackageBuilder';

jest.mock('../../../../src/core/package/SfpPackageBuilder', () => {
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
                await propertyFetcher.getsfpProperties(sfpPackage, logger);
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
        reconcileProfilePropertyFetcher.getsfpProperties(sfpPackage);
        expect(sfpPackage.reconcileProfiles).toBe(false);
    });
});

const packageDescriptor: any = {
    path: 'force-app',
    package: 'force-app',
    versionNumber: '1.0.0.NEXT',
    reconcileProfiles: false,
};
