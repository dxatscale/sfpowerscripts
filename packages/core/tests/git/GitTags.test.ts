import { jest, expect } from '@jest/globals';
import GitTags from '../../src/git/GitTags';
import Git from '../../src/git/Git';

import child_process = require('child_process');

let tags: string[];
jest.mock('../../src/git/Git', () => {
    class Git {
        tag = jest.fn().mockReturnValue(tags);
        log = jest.fn().mockReturnValue(gitLog);
        getRepositoryPath()
        {
            return process.cwd();
        }
        static async initiateRepo(){
          return new Git();
        }
    }

    return Git;
});

describe('Given a package, listTagsOnBranch', () => {
    beforeEach(() => {
        const childProcessMock = jest.spyOn(child_process, 'execSync');
        childProcessMock.mockImplementation(() => showRefs);
    });

    it('should return tags belonging to package, on current branch', async () => {
        tags = coreTags;
        let git: Git = await Git.initiateRepo();
        const gitTags: GitTags = new GitTags(git, 'core');
        expect(await gitTags.listTagsOnBranch()).toEqual(coreTags.slice(0, 4));
    });

    it('should return an empty array if there are no tags', async () => {
        tags = [];
        let git: Git = await Git.initiateRepo();
        const gitTags: GitTags = new GitTags(git, 'core');
        expect(await gitTags.listTagsOnBranch()).toEqual([]);
    });

    it('should return an empty array if there are no tags belonging to package, on current branch', async () => {
        tags = coreTags.slice(4);
        let git: Git = await Git.initiateRepo();
        const gitTags: GitTags = new GitTags(git, 'core');
        expect(await gitTags.listTagsOnBranch()).toEqual([]);
    });
});

// Last two tags are not found on the current branch
const coreTags = [
    'core_v1.0.0.11',
    'core_v1.0.0.43',
    'core_v1.0.0.48',
    'core_v1.0.0.53',
    'core_v1.0.0.85',
    'core_v1.0.0.163',
];

// Commits on current branch
const gitLog = [
    '9d7795b9e2391a93b72ae7cf391f55eac5a869c1',
    '65ed6f19bb87d31e56efd49cd50a6a19ba172626',
    '9e244f0048f53858fe5e5aff210805389f10e523',
    '544b52bea434aed68770adb23c168bb89a35b031',
];

const showRefs = Buffer.from(
    'fc29c8bedb5cc32b425825aeec6c5ae054704b85 refs/tags/core_v1.0.0.11\n' +
        '9d7795b9e2391a93b72ae7cf391f55eac5a869c1 refs/tags/core_v1.0.0.11^{}\n' +
        '4fcb4b948d174e721093ff63ffff59cb220ddd7b refs/tags/core_v1.0.0.43\n' +
        '65ed6f19bb87d31e56efd49cd50a6a19ba172626 refs/tags/core_v1.0.0.43^{}\n' +
        'ed45cbda7daee5152db1353960fe0ae3b8ad5ed2 refs/tags/core_v1.0.0.48\n' +
        '9e244f0048f53858fe5e5aff210805389f10e523 refs/tags/core_v1.0.0.48^{}\n' +
        '9eb7e59ef46890495b4c7d9e6cfb2c5e2ef85851 refs/tags/core_v1.0.0.53\n' +
        '544b52bea434aed68770adb23c168bb89a35b031 refs/tags/core_v1.0.0.53^{}\n' +
        '4af7e0c6b1f663e5b1c2ecc9e424fba2af8e0d63 refs/tags/core__v1.0.0.85\n' +
        '46dd375e91d5c00a0f9b64ee38350171f9cf4e50 refs/tags/core_v1.0.0.85^{}\n' +
        '1a5c15c8decb0a939447aebf057e1d0889f4eeb6 refs/tags/core_v1.0.0.163\n' +
        '86f2f2d107564b053c40abe66555c354f3b7f0f8 refs/tags/core_v1.0.0.163^{}\n'
);
