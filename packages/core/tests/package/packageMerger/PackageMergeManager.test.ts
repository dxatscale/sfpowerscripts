import ArtifactFetcher from '../../../src/artifacts/ArtifactFetcher';
import SfpPackage from '../../../src/package/SfpPackage';
import SfpPackageBuilder from '../../../src/package/SfpPackageBuilder';
import PackageMergeManager from '../../../src/package/packageMerger/PackageMergeManager'
import { ConsoleLogger } from '@dxatscale/sfp-logger';
const path = require('path');

describe('Given multiple sfpPackages, packageManager should be', () => {
    it('able to merge into a single package', async () => {
        let artifacts = ArtifactFetcher.fetchArtifacts(path.join(__dirname, 'artifacts1'), undefined, undefined);
        let sfpPackages: SfpPackage[] = [];

        for (const artifact of artifacts) {
            let sfpPackage = await SfpPackageBuilder.buildPackageFromArtifact(artifact, new ConsoleLogger());
            sfpPackages.push(sfpPackage);
        }
        
        let packageMerger = new PackageMergeManager(sfpPackages);
        let mergeResult = await packageMerger.mergePackages();
         
        expect(mergeResult.mergedPackages.length).toBeGreaterThanOrEqual(2);
        expect(mergeResult.mergedPackage.apexTestClassses?.length).toBeGreaterThanOrEqual(7);
        expect(mergeResult.mergedPackage.isApexFound).toBeTruthy();
        

    },1000000);
});
