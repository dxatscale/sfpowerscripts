import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import FetchImpl from '../../../impl/artifacts/FetchImpl';
import ReleaseDefinition from "../../../impl/release/ReleaseDefinition";

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'fetch');

export default class Fetch extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:artifacts:fetch -p myreleasedefinition.yaml -f myscript.sh`,
    `$ sfdx sfpowerscripts:artifacts:fetch -p myreleasedefinition.yaml --npm --scope myscope --npmrcpath path/to/.npmrc`
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
      let releaseDefinition = new ReleaseDefinition(
        this.flags.releasedefinition,
        this.flags.npm
      ).releaseDefinition;

      let fetchImpl: FetchImpl = new FetchImpl(
        releaseDefinition,
        this.flags.artifactdir,
        this.flags.scriptpath,
        this.flags.npm,
        this.flags.scope,
        this.flags.npmrcpath
      );
      await fetchImpl.exec();
    } catch (err) {
      console.log(err.message);

      // Fail the task when an error occurs
      process.exitCode = 1;
    }
  }

  protected validateFlags() {
    if (this.flags.npm && !this.flags.scope)
      throw new Error("--scope parameter is required for NPM");
  }
}
