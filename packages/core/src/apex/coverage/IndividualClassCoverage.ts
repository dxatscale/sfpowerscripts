import SFPLogger, { Logger, LoggerLevel } from "@dxatscale/sfp-logger"

export default class IndividualClassCoverage {
    public constructor(private codeCoverage: any, private logger: Logger) {}

    public getIndividualClassCoverage(classesToBeValidated?:string[]): ClassCoverage[] {
        let individualClassCoverage: {
            name: string;
            coveredPercent: number;
        }[] = [];

        // Return every class in coverage json if test level is not RunAllTestsInPackage
        individualClassCoverage = this.codeCoverage.map((cls) => {
            return { name: cls.name, coveredPercent: cls.coveredPercent };
        });

         // Filter individualClassCoverage based on classesToBeValidated
        if(classesToBeValidated && classesToBeValidated.length > 0)
        individualClassCoverage = individualClassCoverage.filter((cls) => {
             return classesToBeValidated.includes(cls.name);
        });


        return individualClassCoverage;
    }

    public validateIndividualClassCoverage(
        individualClassCoverage: ClassCoverage[],
        coverageThreshold?: number
    ): {
        result: boolean;
        message: string;
        classesCovered?: ClassCoverage[];
        classesWithInvalidCoverage?: ClassCoverage[];
    } {
        if (coverageThreshold < 75) {
            SFPLogger.log('Setting minimum coverage percentage to 75%.', LoggerLevel.INFO, this.logger);
            coverageThreshold = 75;
        }

        SFPLogger.log(
            `Validating individual classes for code coverage greater than ${coverageThreshold} percent`,
            LoggerLevel.INFO,
            this.logger
        );
        let classesWithInvalidCoverage = individualClassCoverage.filter((cls) => {
            return cls.coveredPercent < coverageThreshold;
        });

        if (classesWithInvalidCoverage.length > 0) {
            return {
                result: false,
                message: 'There are classes which do not satisfy the individual coverage requirements',
                classesCovered: individualClassCoverage,
                classesWithInvalidCoverage: classesWithInvalidCoverage,
            };
        } else
            return {
                result: true,
                message: 'All classes in this test run meet the required coverage threshold',
                classesCovered: individualClassCoverage,
            };
    }
}

export type CoverageOptions = {
    isPackageCoverageToBeValidated: boolean;
    isIndividualClassCoverageToBeValidated: boolean;
    coverageThreshold: number;
    classesToBeValidated?: string[];
};

export type ClassCoverage = {
    name: string;
    coveredPercent: number;
};
