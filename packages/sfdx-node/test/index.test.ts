import {expect, should, use} from 'chai';
import * as path from 'path';
import {registerNamespace, sfdx} from '../lib';

should();
// tslint:disable-next-line:no-var-requires no-require-imports
use(require('chai-as-promised'));

describe('sfdx force', () => {
    it('sfdx object properties', () => {
        expect(sfdx).to.haveOwnProperty('force');
        expect(Object.keys(sfdx).length).to.eq(1);
        expect(sfdx.force).to.be.instanceOf(Function);
        expect(sfdx.force).to.haveOwnProperty('org');
        expect(sfdx.force.org).to.haveOwnProperty('list');
        expect(sfdx.force.config).to.haveOwnProperty('get');
        expect(sfdx.force.config).to.haveOwnProperty('list');
        expect(sfdx.force.config).to.haveOwnProperty('set');
        expect(sfdx.force.data.tree).to.haveOwnProperty('import');
        expect(sfdx.force.data.tree).to.haveOwnProperty('export');
        expect(sfdx.force.data.tree.import).to.be.instanceOf(Function);

        registerNamespace({namespace: 'ns', commandsDir: path.join(__dirname, 'test-commands')});
        expect(Object.keys(sfdx).length).to.eq(2);
        expect(sfdx.ns).not.to.be.instanceOf(Function);
        expect(sfdx.ns).to.haveOwnProperty('example');
        expect(sfdx.ns.example).to.be.instanceOf(Function);
    });

    it('base', async () => {
        await sfdx.force().should.eventually.have.ownProperty('apiVersion');
    });

    it('config list while quiet', async () => {
        await sfdx.force.config.list({quiet: true})
            .should.eventually.be.instanceOf(Array);
    });

    it('config list', async () => {
        await sfdx.force.config.list({quiet: false})
            .should.eventually.be.instanceOf(Array);
    });

    it('config get', async () => {
        await sfdx.force.config.get({}, 'defaultusername')
            .should.eventually.be.instanceOf(Array);
    });

    it('config get flags array', async () => {
        await sfdx.force.config.get({quiet: true}, ['defaultusername'])
            .should.eventually.be.instanceOf(Array);
    });

    it('config set throw', async () => {
        await sfdx.force.config.set()
            .should.eventually.be.rejected.with.instanceOf(Array)
            .that.has.length(1)
            .to.have.nested.property('[0]')
            .to.deep.nested.include({
                commandName: 'ConfigSetCommand',
                exitCode: 1,
                message: 'Provide required name=value pairs for the command. Enclose any values that contain spaces in double quotes.',
            });
    });
});
