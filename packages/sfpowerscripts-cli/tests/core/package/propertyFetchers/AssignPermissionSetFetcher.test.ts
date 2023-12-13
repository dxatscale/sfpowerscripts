import { jest, expect } from '@jest/globals';
import { Logger } from '@flxblio/sfp-logger';
import AssignPermissionSetFetcher from '../../../../src/core/package/propertyFetchers/AssignPermissionSetFetcher';
import PropertyFetcher from '../../../../src/core/package/propertyFetchers/PropertyFetcher';
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
            let propertyFetchers: PropertyFetcher[] = [new AssignPermissionSetFetcher()];

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

describe('Given a package descriptor with assignPermSetsPreDeployment or assignPermSetsPostDeployment', () => {
    it('Should set assignPermSetsPreDeployment property in SfpPackage', async () => {
        let assignPermissionSetFetcher: AssignPermissionSetFetcher = new AssignPermissionSetFetcher();
        let sfpPackage: SfpPackage = await SfpPackageBuilder.buildPackageFromProjectDirectory(null, null, null);
        assignPermissionSetFetcher.getsfpProperties(sfpPackage);
        expect(sfpPackage.assignPermSetsPreDeployment).toStrictEqual(['PermSetB']);
    });

    it('Should set assignPermSetsPostDeployment property in SfpPackage', async () => {
        let assignPermissionSetFetcher: AssignPermissionSetFetcher = new AssignPermissionSetFetcher();
        let sfpPackage: SfpPackage = await SfpPackageBuilder.buildPackageFromProjectDirectory(null, null, null);
        assignPermissionSetFetcher.getsfpProperties(sfpPackage);
        expect(sfpPackage.assignPermSetsPostDeployment).toStrictEqual(['PermSetA']);
    });
});

const packageDescriptor: any = {
    path: 'force-app',
    package: 'force-app',
    versionNumber: '1.0.0.NEXT',
    assignPermSetsPostDeployment: ['PermSetA'],
    assignPermSetsPreDeployment: ['PermSetB'],
};
