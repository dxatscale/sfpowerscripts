import { jest, expect } from '@jest/globals';
import { tmpdir } from 'os';
const fs = require('fs-extra');
const tmp = require('tmp');
import simplegit, { SimpleGit } from 'simple-git';
const path = require('path');
import { AlignImpl, AlignRepoProps } from '../../../src/impl/repo/AlignImpl';

describe('Given a release definition, align packages in the repository to exact versions', () => {
    it('should set the project directory to exact versions as inp', async () => {
        let locationOfCopiedDirectory = tmp.dirSync({ unsafeCleanup: true });
        console.log(`Temp Dir`, locationOfCopiedDirectory.nme);
        let git: SimpleGit = simplegit();
        await git.clone(`https://github.com/dxatscale/sfpowerscripts-test-repo.git`, locationOfCopiedDirectory.name);
        fs.mkdirpSync(path.join(tmpdir.name, 'artifacts'));
        fs.copySync(path.join(__dirname, 'resources'), path.join(tmp.name, 'artifacts'));

        let alignProps: AlignRepoProps = {
            artifactDirectory: path.join(tmp.name, 'artifacts'),
            workingDirectory: locationOfCopiedDirectory.name,
        };
        let alignImpl: AlignImpl = new AlignImpl(alignProps);
        alignImpl.exec();


    }, 400000);
});
