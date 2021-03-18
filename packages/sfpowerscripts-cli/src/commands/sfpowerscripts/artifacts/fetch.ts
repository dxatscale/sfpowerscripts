import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import FetchImpl from '../../../impl/artifacts/fetchImpl';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'fetch');

export default class Fetch extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:artifacts:fetch`
  ];

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  protected static flagsConfig = {
    releasedefinition: flags.filepath({
      char: "p",
      description: messages.getMessage('releaseDefinitionFlagDescription')
    }),
    artifactdir: flags.directory({
      required: true,
      char: 'd',
      description: messages.getMessage('artifactDirectoryFlagDescription'),
      default: 'artifacts'
    }),
    scriptpath: flags.filepath({
      char: 'f',
      description: messages.getMessage('scriptPathFlagDescription')
    }),
    npm: flags.boolean({
      description: messages.getMessage('npmFlagDescription'),
      exclusive: ['scriptpath']
    }),
    scope: flags.string({
      description: messages.getMessage('scopeFlagDescription'),
      dependsOn: ['npm'],
      parse: (scope) => scope.replace(/@/g,"").toLowerCase()
    }),
    npmrcpath: flags.filepath({
      description: messages.getMessage('npmrcPathFlagDescription'),
      dependsOn: ['npm'],
      required: false
    })
  };


  public async execute(){
    this.validateFlags();

    try {
      let fetchImpl: FetchImpl = new FetchImpl(
        this.flags.releasedefinition,
        this.flags.artifactdir,
        this.flags.scriptpath,
        this.flags.npm,
        this.flags.scope,
        this.flags.npmrcpath
      );
      fetchImpl.exec();
    } catch (err) {
      console.log(err.message);

      // Fail the task when an error occurs
      process.exitCode = 1;
    } finally {

    }
  }

  private validateFlags() {
    if (this.flags.npm && !this.flags.scope)
      throw new Error("--scope parameter is required for NPM");
  }
}
