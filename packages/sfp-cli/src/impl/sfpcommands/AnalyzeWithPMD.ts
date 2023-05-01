import AnalyzeWithPMDImpl from '@dxatscale/sfpowerscripts.core/lib/sfpowerkitwrappers/AnalyzeWithPMDImpl';
import xml2js = require('xml2js');
const fs = require('fs-extra');
const path = require('path');
const Table = require('cli-table');
import SFPLogger, { LoggerLevel, COLOR_SUCCESS } from '@dxatscale/sfp-logger/lib/SFPLogger';
import lodash = require('lodash');

export default class AnalyzeWithPMD {
    constructor(
        private sourceDirectories: string[],
        private ruleset: 'sfpowerkit' | 'Custom',
        private rulesetPath: string,
        private threshold: number,
        private version: string
    ) {
        if (this.threshold < 1 || this.threshold > 5) throw new Error('Threshold level must be between 1 and 5');
    }

    async exec() {
        // Setup Logging Directory
        fs.mkdirpSync('.sfdx/sfp');

        const sourceDirectories: string[] = this.sourceDirectories;
        const ruleset: string = this.ruleset;

        let rulesetPath = '';
        if (ruleset == 'Custom') {
            let rulesetPath = this.rulesetPath;
            SFPLogger.log(rulesetPath, LoggerLevel.DEBUG);
        }

        // const format: string = this.format;
        // const outputPath: string = this.outputPath;
        const version: string = this.version;
        const threshold: number = this.threshold;

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

        for (const dir of sourceDirectories) {
            let artifactFilePath = path.join('.sfdx/sfp', 'sf-pmd-output.xml');
            // generate pmd output in XML format, for parsing
            let pmdImpl = new AnalyzeWithPMDImpl(dir, rulesetPath, 'xml', artifactFilePath, version);
            await pmdImpl.exec(false);

            if (fs.existsSync(artifactFilePath)) {
                this.parsePmdXmlOutputFile(artifactFilePath, pmdReport);
            } else {
                throw new Error('Failed to generate PMD output');
            }
        }

        const recordsWithViolationOfThreshold = this.getRecordsWithViolationOfThreshold(pmdReport, threshold);
        if (recordsWithViolationOfThreshold.length > 0) {
            this.printViolationsOfThreshold(recordsWithViolationOfThreshold);
        }

        // if (outputPath) {
        //   // generate pmd results in the requested format and at the output path
        //   pmdImpl = new AnalyzeWithPMDImpl(
        //     source_directory,
        //     rulesetpath,
        //     format,
        //     outputPath,
        //     version
        //   );
        //   await pmdImpl.exec(false);
        // }

        if (threshold === 1) {
            if (pmdReport.summary.priority['1'].nViolations > 0)
                throw new Error(
                    `Build failed due to ${pmdReport.summary.priority['1'].nViolations} critical violations found`
                );
        } else {
            for (let i = 1; i <= threshold; i++) {
                if (pmdReport.summary.priority[i].nViolations > 0) {
                    throw new Error(
                        `Build failed due to violations with a priority less than or equal to the threshold ${threshold}`
                    );
                }
            }
        }

        SFPLogger.log(COLOR_SUCCESS('Build succeeded. No violations found.'), LoggerLevel.INFO);
    }

    /**
     * Parse PMD XML output file and update PMD report
     * @param xmlFile
     * @returns
     */
    private parsePmdXmlOutputFile(xmlFile: string, pmdReport: PmdReport): void {
        let xml: string = fs.readFileSync(xmlFile, 'utf-8');
        xml2js.parseString(xml, (err, result) => {
            if (lodash.isEmpty(result)) {
                throw new Error(`Empty PMD XML output ${xmlFile}`);
            } else if (!result.pmd) {
                throw new Error(`Unrecognized PMD XML output ${xmlFile}`);
            }

            if (!result.pmd.file || result.pmd.file.length === 0) {
                // No files with violations
                return;
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
    }

    private getRecordsWithViolationOfThreshold(report: PmdReport, threshold: number) {
        const recordsWithViolationsOfThreshold: Record[] = [];

        report.data.forEach((record) => {
            const violationsOfThreshold = record.violations.filter((violation) => violation.priority <= threshold);

            if (violationsOfThreshold.length > 0) {
                recordsWithViolationsOfThreshold.push({ filepath: record.filepath, violations: violationsOfThreshold });
            }
        });

        return recordsWithViolationsOfThreshold;
    }

    private printViolationsOfThreshold(recordsWithViolationOfThreshold: Record[]): void {
        let table = new Table({
            head: ['File', 'Priority', 'Line Number', 'Rule', 'Description'],
        });

        recordsWithViolationOfThreshold.forEach((record) => {
            record.violations.forEach((violation) => {
                table.push([
                    path.relative(process.cwd(), record.filepath),
                    violation.priority,
                    violation.beginLine,
                    violation.rule,
                    violation.description.trim(),
                ]);
            });
        });

        SFPLogger.log(table.toString(), LoggerLevel.INFO);
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
