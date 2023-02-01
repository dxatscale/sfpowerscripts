import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../../SfpowerscriptsCommand';
import { Messages, SfdxError } from '@salesforce/core';
import AnalyzeWithPMDImpl from '@dxatscale/sfpowerscripts.core/lib/sfpowerkitwrappers/AnalyzeWithPMDImpl';
import xml2js = require('xml2js');
const fs = require('fs-extra');
const path = require('path');
import * as rimraf from 'rimraf';
const Table = require('cli-table');
import SFPLogger, { LoggerLevel, COLOR_SUCCESS } from '@dxatscale/sfp-logger';
import lodash = require('lodash');
import { ZERO_BORDER_TABLE } from '../../../ui/TableConstants';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.load('@dxatscale/sfpowerscripts', 'analyze_with_PMD',[
    'sourceDirectoryFlagDescription',
    'rulesetFlagDescription',
    'rulesetPathFlagDescription',
    'formatFlagDescription',
    'outputPathFlagDescription',
    'thresholdFlagDescription',
    'versionFlagDescription',
    'isToBreakBuildFlagDescription',
    'refNameFlagDescription',
    'commandDescription'
]);

export default class AnalyzeWithPMD extends SfpowerscriptsCommand {
    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfdx sfpowerscripts:analyze:pmd --sourcedir <dir>\n`,
        `Output variable:`,
        `sfpowerscripts_pmd_output_path`,
        `<refname>_sfpowerscripts_pmd_output_path`,
    ];

    protected static requiresProject = true;
    protected static requiresUsername = false;
    protected static requiresDevhubUsername = false;
    protected static flagsConfig = {
        sourcedir: flags.string({
            description: messages.getMessage('sourceDirectoryFlagDescription'),
        }),
        ruleset: flags.string({
            description: messages.getMessage('rulesetFlagDescription'),
            options: ['sfpowerkit', 'Custom'],
            default: 'sfpowerkit',
        }),
        rulesetpath: flags.string({
            description: messages.getMessage('rulesetPathFlagDescription'),
        }),
        format: flags.string({
            description: messages.getMessage('formatFlagDescription'),
            options: [
                'text',
                'textcolor',
                'csv',
                'emacs',
                'summaryhtml',
                'html',
                'xml',
                'xslt',
                'yahtml',
                'vbhtml',
                'textpad',
                'sarif',
            ],
            default: 'text',
        }),
        outputpath: flags.string({
            char: 'o',
            description: messages.getMessage('outputPathFlagDescription'),
        }),
        version: flags.string({
            required: false,
            default: '6.39.0',
            description: messages.getMessage('versionFlagDescription'),
        }),
        threshold: flags.integer({
            required: false,
            default: 1,
            min: 1,
            max: 5,
            description: messages.getMessage('thresholdFlagDescription'),
        }),
        istobreakbuild: flags.boolean({
            char: 'b',
            deprecated: {
                message:
                '--istobreakbuild has been deprecated, the command will always break if there are critical errors',
                messageOverride:
                    '--istobreakbuild has been deprecated, the command will always break if there are critical errors',
            },
            description: messages.getMessage('isToBreakBuildFlagDescription'),
        }),
        refname: flags.string({
            description: messages.getMessage('refNameFlagDescription'),
        }),
        loglevel: flags.enum({
            description: 'logging level for this command invocation',
            default: 'info',
            required: false,
            options: [
                'trace',
                'debug',
                'info',
                'warn',
                'error',
                'fatal',
                'TRACE',
                'DEBUG',
                'INFO',
                'WARN',
                'ERROR',
                'FATAL',
            ],
        }),
    };

    public async execute() {
        try {
            // Setup Logging Directory
            rimraf.sync('sfpowerscripts');
            fs.mkdirpSync('.sfpowerscripts');

            const source_directory: string = this.flags.sourcedir;
            const ruleset: string = this.flags.ruleset;

            let rulesetpath = '';
            if (ruleset == 'Custom') {
                rulesetpath = this.flags.rulesetpath;
                SFPLogger.log(rulesetpath, LoggerLevel.DEBUG);
            }

            const format: string = this.flags.format;
            const outputPath: string = this.flags.outputpath;
            const version: string = this.flags.version;

            let pmdReport: PmdReport;

            let artifactFilePath = path.join('.sfpowerscripts', 'sf-pmd-output.xml');
            // generate pmd output in XML format, for parsing
            let pmdImpl = new AnalyzeWithPMDImpl(source_directory, rulesetpath, 'xml', artifactFilePath, version);
            await pmdImpl.exec(false);

            if (fs.existsSync(artifactFilePath)) {
                pmdReport = this.parsePmdXmlOutputFile(artifactFilePath);
            } else {
                throw new SfdxError('Failed to generate PMD output');
            }

            this.printPmdReport(pmdReport);

            if (outputPath) {
                // generate pmd results in the requested format and at the output path
                pmdImpl = new AnalyzeWithPMDImpl(source_directory, rulesetpath, format, outputPath, version);
                await pmdImpl.exec(false);

                this.writeDotEnv();
            }

            if (this.flags.threshold === 1) {
                if (pmdReport.summary.priority['1'].nViolations > 0)
                    throw new SfdxError(
                        `Build failed due to ${pmdReport.summary.priority['1'].nViolations} critical violations found`
                    );
            } else {
                for (let i = 1; i <= this.flags.threshold; i++) {
                    if (pmdReport.summary.priority[i].nViolations > 0) {
                        throw new SfdxError(
                            `Build failed due to violations with a priority less than or equal to the threshold ${this.flags.threshold}`
                        );
                    }
                }
            }
        } catch (err) {
            SFPLogger.log(err, LoggerLevel.ERROR);
            // Fail the task when an error occurs
            process.exit(1);
        }
    }

    /**
     * Write output variables to dot env file
     */
    private writeDotEnv() {
        if (this.flags.refname) {
            fs.writeFileSync(
                '.env',
                `${this.flags.refname}_sfpowerscripts_pmd_output_path=${this.flags.outputpath}\n`,
                { flag: 'a' }
            );
        } else {
            fs.writeFileSync('.env', `sfpowerscripts_pmd_output_path=${this.flags.outputpath}\n`, { flag: 'a' });
        }
    }

    /**
     * Parse PMD XML output file and return a PMD report in JSON
     * @param xmlFile
     * @returns
     */
    private parsePmdXmlOutputFile(xmlFile: string): PmdReport {
        const pmdReport: PmdReport = {
            summary: {
                totalViolations: 0,
                totalFiles: 0,
                priority: {
                    1: {
                        nViolations: 0,
                    },
                    2: {
                        nViolations: 0,
                    },
                    3: {
                        nViolations: 0,
                    },
                    4: {
                        nViolations: 0,
                    },
                    5: {
                        nViolations: 0,
                    },
                },
            },
            data: [],
        };

        let xml: string = fs.readFileSync(xmlFile, 'utf-8');
        xml2js.parseString(xml, (err, result) => {
            if (lodash.isEmpty(result)) {
                throw new SfdxError(`Empty PMD XML output ${xmlFile}`);
            } else if (!result.pmd) {
                throw new SfdxError(`Unrecognized PMD XML output ${xmlFile}`);
            }

            if (!result.pmd.file || result.pmd.file.length === 0) {
                // No files with violations, return empty PMD report
                return pmdReport;
            }

            result.pmd.file.forEach((file: any) => {
                let record: Record = {
                    filepath: file.$.name,
                    violations: [],
                };

                file.violation.forEach((elem) => {
                    let violation: Violation = {
                        description: elem._,
                        beginLine: parseInt(elem.$.beginline, 10),
                        endLine: parseInt(elem.$.endline, 10),
                        beginColumn: parseInt(elem.$.begincolumn, 10),
                        endColumn: parseInt(elem.$.endcolumn, 10),
                        rule: elem.$.rule,
                        ruleset: elem.$.ruleset,
                        externalInfoUrl: elem.$.externalInfoUrl,
                        priority: parseInt(elem.$.priority, 10),
                    };

                    pmdReport.summary.priority[violation.priority].nViolations++;

                    record.violations.push(violation);
                });

                pmdReport.summary.totalViolations += record.violations.length;

                pmdReport.data.push(record);
            });

            pmdReport.summary.totalFiles = pmdReport.data.length;
        });

        return pmdReport;
    }

    private printPmdReport(report: PmdReport): void {
        if (report.data.length === 0) {
            SFPLogger.log(COLOR_SUCCESS('Build succeeded. No violations found.'), LoggerLevel.INFO);
            return;
        }

        for (let i = 0; i < report.data.length; i++) {
            SFPLogger.log(`\n${report.data[i].filepath}`, LoggerLevel.INFO);
            let table = new Table({
                head: ['Priority', 'Line Number', 'Rule', 'Description'],
                chars: ZERO_BORDER_TABLE
            });

            report.data[i].violations.forEach((violation) => {
                table.push([violation.priority, violation.beginLine, violation.rule, violation.description.trim()]);
            });

            SFPLogger.log(table.toString(), LoggerLevel.INFO);
        }
    }
}

interface PmdReport {
    summary: {
        totalViolations: number;
        totalFiles: number;
        priority: {
            [p: number]: {
                nViolations: number;
            };
        };
    };
    data: Record[];
}

interface Record {
    filepath: string;
    violations: Violation[];
}

interface Violation {
    description: string;
    beginLine: number;
    endLine: number;
    beginColumn: number;
    endColumn: number;
    rule: string;
    ruleset: string;
    externalInfoUrl: string;
    priority: number;
}
