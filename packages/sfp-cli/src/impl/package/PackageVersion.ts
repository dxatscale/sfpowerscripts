/**
 * TODO: Replace with class from core library
 */
export default class PackageVersion {
    private _major: number;
    private _minor: number;
    private _patch: number;
    private _buildNum?: number | 'LATEST' | 'NEXT';

    get major() {
        return this._major;
    }

    set major(value: number) {
        if (Number.isInteger(value)) {
            this._major = value;
        } else {
            throw new Error('Major version must be an integer');
        }
    }

    get minor() {
        return this._minor;
    }

    set minor(value: number) {
        if (Number.isInteger(value)) {
            this._minor = value;
        } else {
            throw new Error('Minor version must be an integer');
        }
    }

    get patch() {
        return this._patch;
    }

    set patch(value: number) {
        if (Number.isInteger(value)) {
            this._patch = value;
        } else {
            throw new Error('Patch version must be an integer');
        }
    }

    get buildNum() {
        return this._buildNum;
    }

    set buildNum(value: number | 'LATEST' | 'NEXT') {
        if (Number.isInteger(value) || value === 'LATEST' || value === 'NEXT') {
            this._buildNum = value;
        } else {
            throw new Error('Build number must be an integer, LATEST or NEXT');
        }
    }

    getVersionNumber(): string {
        // decode
        let versionNumber = `${this._major}.${this._minor}.${this._patch}`;
        if (this._buildNum) {
            versionNumber += `.${this._buildNum}`;
        }
        return versionNumber;
    }

    constructor(versionNumber: string) {
        const match = versionNumber.match(
            /^(?<major>[0-9]+)\.(?<minor>[0-9]+)\.(?<patch>[0-9]+)(\.(?<buildNum>[0-9]+|LATEST|NEXT))?$/
        );

        if (match) {
            // encode
            this._major = parseInt(match.groups.major);
            this._minor = parseInt(match.groups.minor);
            this._patch = parseInt(match.groups.patch);

            if (match.groups.buildNum) {
                if (typeof match.groups.buildNum === 'number') {
                    this._buildNum = parseInt(match.groups.buildNum);
                } else if (typeof match.groups.buildNum === 'string') {
                    this._buildNum = match.groups.buildNum as 'LATEST' | 'NEXT';
                }
            }
        } else {
            throw new Error(
                `Invalid version number. Must be of the format 1.0.0 , 1.0.0.0 , 1.0.0.NEXT or 1.0.0.LATEST`
            );
        }
    }

    /**
     *
     * @param positional MAJOR, MINOR, PATCH, BUILDNUMBER,
     * @returns version incremented at positional
     */
    increment(positional: Positional) {
        if (positional === Positional.MAJOR) {
            this.incrementMajorVersion();
        } else if (positional === Positional.MINOR) {
            this.incrementMinorVersion();
        } else if (positional === Positional.PATCH) {
            this.incrementPatchVersion();
        } else if (positional === Positional.BUILDNUMBER) {
            this.incrementBuildNumber();
        }

        return this.getVersionNumber();
    }

    private incrementBuildNumber() {
        if (typeof this._buildNum === 'number') {
            this._buildNum++;
        }
    }

    private incrementPatchVersion() {
        this._patch++;

        if (typeof this._buildNum === 'number') {
            this._buildNum = 0;
        }
    }

    private incrementMinorVersion() {
        this._minor++;
        this._patch = 0;

        if (typeof this._buildNum === 'number') {
            this._buildNum = 0;
        }
    }

    private incrementMajorVersion() {
        this._major++;
        this._minor = 0;
        this._patch = 0;

        if (typeof this._buildNum === 'number') {
            this._buildNum = 0;
        }
    }
}

export enum Positional {
    MAJOR = 'major',
    MINOR = 'minor',
    PATCH = 'patch',
    BUILDNUMBER = 'buildnumber',
}
