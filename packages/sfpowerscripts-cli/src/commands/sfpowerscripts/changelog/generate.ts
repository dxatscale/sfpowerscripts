import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import ChangelogImpl from '../../../impl/changelog/ChangelogImpl';



Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'generate_changelog');

export default class GenerateChangelog extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:changelog:generate -n <releaseName> -d path/to/artifact/directory -w <regexp> -r <repoURL> -b <branchName>`
  ];

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  protected static flagsConfig = {
    limit: flags.integer({
        description: messages.getMessage('limitFlagDescription')
    }),
    artifactdir: flags.directory({
      required: true,
      char: 'd',
      description: messages.getMessage('artifactDirectoryFlagDescription'),
      default: 'artifacts'
    }),
    releasename: flags.string({
      required: true,
      char: 'n',
      description: messages.getMessage('releaseNameFlagDescription')
    }),
    workitemfilter: flags.string({
      required: true,
      char: 'w',
      description: messages.getMessage('workItemFilterFlagDescription')
    }),
    workitemurl: flags.string({
      required: false,
      description: messages.getMessage('workItemUrlFlagDescription')
    }),
    repourl: flags.string({
      required: false,
      char: "r",
      description: messages.getMessage('repoUrlFlagDescription'),
      deprecated: { messageOverride: "--repourl has been deprecated" },
      hidden: true
    }),
    branchname: flags.string({
      required: true,
      char: "b",
      description: messages.getMessage('branchNameFlagDescription')
    }),
    showallartifacts: flags.boolean({
      required: false,
      description: messages.getMessage('showAllArtifactsFlagDescription')
    }),
    forcepush: flags.boolean({
      description: messages.getMessage('forcePushFlagDescription'),
      hidden: true,
      default: false
    }),
    loglevel: flags.enum({
      description: "logging level for this command invocation",
      default: "info",
      required: false,
      options: [
        "trace",
        "debug",
        "info",
        "warn",
        "error",
        "fatal",
        "TRACE",
        "DEBUG",
        "INFO",
        "WARN",
        "ERROR",
        "FATAL",
      ],
    })
  };

  async run() {
    try {
      let changelogImpl: ChangelogImpl = new ChangelogImpl(
        this.flags.artifactdir,
        this.flags.releasename,
        this.flags.workitemfilter,
        this.flags.limit,
        this.flags.workitemurl,
        this.flags.showallartifacts,
        this.flags.forcepush,
        this.flags.branchname,
        null
      );

      await changelogImpl.exec();
    } catch (err) {

      let errorMessage: string = "";
      if (err instanceof Array) {
        for (let e of err) {
          errorMessage += e.message + `\n`;
        }
      } else {
        errorMessage = err.message;
      }
      console.log(errorMessage);

      process.exit(1);
    }
  }
}
