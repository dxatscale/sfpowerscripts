import ignore, { Ignore } from 'ignore';

export default class IgnoreFiles {
    private _ignore: Ignore;

    constructor(pattern: string) {
        this._ignore = ignore().add(pattern);
    }

    filter(pathnames: string[]): string[] {
        return this._ignore.filter(pathnames);
    }
}
