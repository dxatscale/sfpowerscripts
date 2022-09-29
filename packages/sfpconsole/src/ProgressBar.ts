import cli from 'cli-ux';

export default class ProgressBar {
    private progressBarImpl;

    public create(title: string, unit: string, displayTillLogLevel: number): ProgressBar {
            this.progressBarImpl = cli.progress({
                format: `${title} - PROGRESS  | {bar} | {value}/{total} ${unit}`,
                barCompleteChar: '\u2588',
                barIncompleteChar: '\u2591',
                linewrap: true,
            });

        return this;
    }

    public start(totalSize: number) {
      if (!(this.progressBarImpl === null || this.progressBarImpl === undefined)){
        this.progressBarImpl.start(totalSize);
      }
    }

    public stop() {
      if (!(this.progressBarImpl === null || this.progressBarImpl === undefined)) {
        this.progressBarImpl.stop();
      }
    }

    public increment(count: number) {
      if (!(this.progressBarImpl === null || this.progressBarImpl === undefined)){
        this.progressBarImpl.increment(count);
      }
    }
}
