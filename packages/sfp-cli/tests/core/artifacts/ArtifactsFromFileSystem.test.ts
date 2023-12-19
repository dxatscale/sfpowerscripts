import { jest, expect } from '@jest/globals';
import ArtifactFetcher from '../../../src/core/artifacts/ArtifactFetcher';
import * as globSync from 'glob';

describe('Provided a path to the artifacts folder containing sfp artifact', () => {
    it('should return all the artifacts, if a package name is not provided', () => {

        jest.spyOn(globSync, 'globSync').mockImplementationOnce((pattern: string | string[], options: any) => { 
            return [
                '/path/to/core_sfpowerscripts_artifact_1.0.0-2.zip',
                '/path/to/core2_sfpowerscripts_artifact_1.0.0-2.zip',
                '/path/to/core3_sfpowerscripts_artifact_1.0.0-3.zip',
                '/path/to/my-package_sfpowerscripts_artifact_3.30.53-NEXT.tgz'
            ];
         });

       
        let artifacts = ArtifactFetcher.findArtifacts('artifacts');
        expect(artifacts).toEqual(
            [
                '/path/to/core_sfpowerscripts_artifact_1.0.0-2.zip',
                '/path/to/core2_sfpowerscripts_artifact_1.0.0-2.zip',
                '/path/to/core3_sfpowerscripts_artifact_1.0.0-3.zip',
                '/path/to/my-package_sfpowerscripts_artifact_3.30.53-NEXT.tgz'
            ]
        );
    });

    it('provided only one artifact exists for a package and a package name is provided, it should just return the one artifact', () => {

        jest.spyOn(globSync, 'globSync').mockImplementationOnce((pattern: string | string[], options: any) => {
            return new Array('/path/to/core_sfpowerscripts_artifact_1.0.0-2.zip');
         });

        let artifacts = ArtifactFetcher.findArtifacts('artifacts', 'core');
        expect(artifacts).toEqual(new Array('/path/to/core_sfpowerscripts_artifact_1.0.0-2.zip'));
    });

    it('provided multiple artifacts of the same package exists and a package name is provied, it should return the latest', () => {

        jest.spyOn(globSync, 'globSync').mockImplementationOnce((pattern: string | string[], options: any) => {
            return [
                '/path/to/core_sfpowerscripts_artifact_1.0.0-2.zip',
                '/path/to/core_sfpowerscripts_artifact_1.0.0-3.zip',
                '/path/to/core_sfpowerscripts_artifact_1.0.0-4.zip',
                '/path/to/core_sfpowerscripts_artifact_1.0.0-5.tgz'
            ];
         });
        let artifacts = ArtifactFetcher.findArtifacts('artifacts', 'core');
        expect(artifacts).toEqual(new Array('/path/to/core_sfpowerscripts_artifact_1.0.0-5.tgz'));
    });
});
