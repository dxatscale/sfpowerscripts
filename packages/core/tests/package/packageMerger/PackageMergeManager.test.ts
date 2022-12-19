import ArtifactFetcher from '../../../src/artifacts/ArtifactFetcher';
import SfpPackage from '../../../src/package/SfpPackage';
import SfpPackageBuilder from '../../../src/package/SfpPackageBuilder';
import PackageMergeManager from '../../../src/package/packageMerger/PackageMergeManager'
import { ConsoleLogger } from '@dxatscale/sfp-logger';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { jest, expect } from '@jest/globals';

const path = require('path');

describe('Given multiple sfpPackages, packageManager should be', () => {
    it('able to merge into a single package', async () => {
        const set = new ComponentSet();
        set.add({ fullName: 'MyClass', type: 'ApexClass' });
        set.add({ fullName: 'MyLayout', type: 'Layout' });

        const componentSetMock = jest.spyOn(ComponentSet, 'fromSource');
        componentSetMock.mockImplementation(() => {
            return set;
        });
        // TODO:  Complete along with PackageMergeManager Feature
        // let artifacts = ArtifactFetcher.fetchArtifacts(path.join(__dirname, 'artifacts1'), undefined, undefined);
        // let sfpPackages: SfpPackage[] = [];

        // for (const artifact of artifacts) {
        //     let sfpPackage = await SfpPackageBuilder.buildPackageFromArtifact(artifact, new ConsoleLogger());
        //     sfpPackages.push(sfpPackage);
        // }
        
        // let packageMerger = new PackageMergeManager(sfpPackages);
        // let mergeResult = await packageMerger.mergePackages();
         
        // expect(mergeResult.mergedPackages.length).toBeGreaterThanOrEqual(2);
        // expect(mergeResult.mergedPackage.apexTestClassses?.length).toBeGreaterThanOrEqual(7);
        // expect(mergeResult.mergedPackage.isApexFound).toBeTruthy();
        

    });
});
