import * as fs from 'fs-extra';
const path = require('path');
const glob = require('glob');

import ApexTypeListener from './listeners/ApexTypeListener';

import {
    ApexLexer,
    ApexParser,
    ApexParserListener,
    CaseInsensitiveInputStream,
    ThrowingErrorListener,
    CommonTokenStream,
    ParseTreeWalker,
} from 'apex-parser';
import SFPLogger, { LoggerLevel } from '@dxatscale/sfp-logger';
import { ApexClasses } from '../../package/SfpPackage';

/**
 * Get Apex type of cls files in a search directory.
 * Sorts files into classes, test classes and interfaces.
 */
export default class ApexTypeFetcher {
    private apexSortedByType: ApexSortedByType = {
        class: [],
        testClass: [],
        interface: [],
        parseError: [],
    };

    constructor(private searchDir: string) {}

    public getClassesClassifiedByType(): ApexSortedByType {
        let clsFiles: string[];
        if (fs.existsSync(this.searchDir)) {
            clsFiles = glob.sync(`**/*.cls`, {
                cwd: this.searchDir,
                absolute: true,
            });
        } else {
            throw new Error(`Search directory does not exist`);
        }

        for (let clsFile of clsFiles) {
            let clsPayload: string = fs.readFileSync(clsFile, 'utf8');
            let fileDescriptor: FileDescriptor = {
                name: path.basename(clsFile, '.cls'),
                filepath: clsFile,
            };

            // Parse cls file
            let compilationUnitContext;
            try {
                let lexer = new ApexLexer(new CaseInsensitiveInputStream(clsFile, clsPayload));
                let tokens: CommonTokenStream = new CommonTokenStream(lexer);

                let parser = new ApexParser(tokens);
                parser.removeErrorListeners();
                parser.addErrorListener(new ThrowingErrorListener());

                compilationUnitContext = parser.compilationUnit();
            } catch (err) {
                SFPLogger.log(`Failed to parse ${clsFile} in ${this.searchDir}`, LoggerLevel.WARN);
                SFPLogger.log(err.message, LoggerLevel.WARN);

                fileDescriptor.error = err;
                this.apexSortedByType.parseError.push(fileDescriptor);

                continue;
            }

            let apexTypeListener: ApexTypeListener = new ApexTypeListener();

            // Walk parse tree to determine Apex type
            ParseTreeWalker.DEFAULT.walk(apexTypeListener as ApexParserListener, compilationUnitContext);

            let apexType = apexTypeListener.getApexType();

            if (apexType.class) {
                this.apexSortedByType.class.push(fileDescriptor);
                if (apexType.testClass) {
                    this.apexSortedByType.testClass.push(fileDescriptor);
                }
            } else if (apexType.interface) {
                this.apexSortedByType.interface.push(fileDescriptor);
            } else {
                fileDescriptor.error = { message: 'Unknown Apex Type' };
                this.apexSortedByType.parseError.push(fileDescriptor);
            }
        }
        return this.apexSortedByType;
    }

    public getTestClasses(): ApexClasses {
        let testClassNames: ApexClasses = this.apexSortedByType.testClass.map((fileDescriptor) => fileDescriptor.name);
        return testClassNames;
    }

    public getClassesOnlyExcludingTestsAndInterfaces(): ApexClasses {
        let packageClasses: ApexClasses = this.apexSortedByType.class.map((fileDescriptor) => fileDescriptor.name);

        if (packageClasses != null) {
            let testClassesInPackage: ApexClasses = this.apexSortedByType.testClass.map(
                (fileDescriptor) => fileDescriptor.name
            );
            if (testClassesInPackage != null && testClassesInPackage.length > 0)
                packageClasses = packageClasses.filter((item) => !testClassesInPackage.includes(item));

            let interfacesInPackage: ApexClasses = this.apexSortedByType.testClass.map(
                (fileDescriptor) => fileDescriptor.name
            );
            if (interfacesInPackage != null && interfacesInPackage.length > 0)
                packageClasses = packageClasses.filter((item) => !interfacesInPackage.includes(item));

            let parseError: ApexClasses = this.apexSortedByType.parseError.map((fileDescriptor) => fileDescriptor.name);
            if (parseError != null && parseError.length > 0)
                packageClasses = packageClasses.filter((item) => !parseError.includes(item));
        }
        return packageClasses;
    }
}

export type ApexSortedByType = {
    class: FileDescriptor[];
    testClass: FileDescriptor[];
    interface: FileDescriptor[];
    parseError: FileDescriptor[];
};

export type FileDescriptor = {
    name: string;
    filepath: string;
    error?: any;
};
