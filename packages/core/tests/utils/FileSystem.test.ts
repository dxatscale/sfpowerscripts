import { expect } from '@jest/globals';
import FileSystem from '../../src/utils/FileSystem';
const path = require('path');

describe('Given a search directory', () => {
    it('should return nested files', () => {
        const resourcesDir = path.join(__dirname, 'resources');
        let files = FileSystem.readdirRecursive(path.join(resourcesDir, 'a'), false, false);
        expect(files).toEqual(expectedFiles);

        files = FileSystem.readdirRecursive(path.join(resourcesDir, 'a'), true, false);
        expect(files).toEqual(expectedFilesIncludingDirs);

        files = FileSystem.readdirRecursive(path.join(resourcesDir, 'a'), false, true);
        expect(files).toEqual(expectedFiles.map((elem) => path.join(resourcesDir, 'a', elem)));

        files = FileSystem.readdirRecursive(path.join(resourcesDir, 'a'), true, true);
        expect(files).toEqual(expectedFilesIncludingDirs.map((elem) => path.join(resourcesDir, 'a', elem)));
    });
});

const expectedFiles = ['b/b1.file', 'b/c/c1.file', 'b/c/c2.file', 'b/d/d1.file', 'b/d/x/x1.file', 'b/e/e1.file'];
const expectedFilesIncludingDirs = [
    'b',
    'b/b1.file',
    'b/c',
    'b/c/c1.file',
    'b/c/c2.file',
    'b/d',
    'b/d/d1.file',
    'b/d/x',
    'b/d/x/x1.file',
    'b/e',
    'b/e/e1.file',
];
