import SFPLogger from '@dxatscale/sfp-logger/lib/SFPLogger';

const Table = require('cli-table');

export default class SourceStatusDisplayer {
    public constructor(private statusResult: any) {}

    public display() {
        const table = new Table({
            head: ['State', 'Full Name', 'Type', 'File Path'],
        });

        this.statusResult.forEach((elem) => {
            table.push([elem.state, elem.fullName, elem.type, elem.filePath ? elem.filePath : 'N/A']);
        });
        if (this.statusResult.length > 0) SFPLogger.log(table.toString());
    }
}
