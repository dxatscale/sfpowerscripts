import SFPLogger, { LoggerLevel } from '@dxatscale/sfp-logger';

//TODO: Move to sfpconsole package
export default class GroupConsoleLogs {
    private static logGroupSymbols?: string[];

    constructor(private section: string) {}

    public static setLogGroupsSymbol(logGroupSymbols: string[]) {
        GroupConsoleLogs.logGroupSymbols = logGroupSymbols;
    }

    public begin():GroupConsoleLogs {
        let sectionStart = this.getSectionStart();
        if (sectionStart && sectionStart.length > 0) SFPLogger.log(sectionStart, LoggerLevel.INFO);
        return this;
    }

    public end():GroupConsoleLogs {
        let sectionEnd = this.getSectionEnd();
        if (sectionEnd && sectionEnd.length > 0) SFPLogger.log(sectionEnd, LoggerLevel.INFO);
        return this;
    }

    private getSectionStart() {
        if (process.env.BUILDKITE) {
            return `--- ${this.section}`;
        } else if (process.env.GITHUB_ACTION) {
            return `::group::${this.section}`;
        } else if (process.env.GITLAB_CI) {
            return `\e[0Ksection_start:${Date.now()}:${this.section}\r\e[0K`;
        } else if (process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI) {
            return `##[group]${this.section}`;
        } else if (GroupConsoleLogs.logGroupSymbols && GroupConsoleLogs.logGroupSymbols[0]) {
            return `${GroupConsoleLogs.logGroupSymbols[0]} ${this.section}`;
        } else {
            return undefined;
        }
    }

    private getSectionEnd() {
        if (process.env.BUILDKITE) {
            return undefined;
        } else if (process.env.GITHUB_ACTION) {
            return `::endgroup::`;
        } else if (process.env.GITLAB_CI) {
            return `\e[0Ksection_end:${Date.now()}:${this.section}\r\e[0K`;
        } else if (process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI) {
            return `##[endgroup]`;
        } else if (GroupConsoleLogs.logGroupSymbols && GroupConsoleLogs.logGroupSymbols[1]) {
            return `${GroupConsoleLogs.logGroupSymbols[1]}`;
        } else {
            return undefined;
        }
    }
}
