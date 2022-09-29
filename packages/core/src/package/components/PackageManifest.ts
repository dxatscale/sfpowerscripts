import path from 'path';
import * as fs from 'fs-extra';
import { ApexClasses } from '../SfpPackage';
import xml2json from '../../utils/xml2json';
const xml2js = require('xml2js');

export default class PackageManifest {
    private _manifestJson;
    private _manifestXml: string;

    /**
     * Getter for package manifest JSON
     */
    get manifestJson() {
        return this._manifestJson;
    }

    /**
     * Getter for package manifest XML
     */
    get manifestXml(): string {
        return this._manifestXml;
    }

    private constructor() {}

    /**
     * Factory method
     * @param mdapiDir directory containing package.xml
     * @returns instance of PackageManifest
     */
    static async create(mdapiDir: string): Promise<PackageManifest> {
        const packageManifest = new PackageManifest();

        const packageXml: string = fs.readFileSync(path.join(mdapiDir, 'package.xml'), 'utf8');

        packageManifest._manifestXml = packageXml;
        packageManifest._manifestJson = await xml2json(packageXml);

        return packageManifest;
    }

    /**
     * Factory method
     * @param components
     * @param apiVersion
     * @returns intance of PackageManifest
     */
    static createFromScratch(components: { fullName: string; type: string }[], apiVersion: string): PackageManifest {
        const packageManifest = new PackageManifest();

        const packageJson = {
            $: { xmlns: 'http://soap.sforce.com/2006/04/metadata' },
            types: [],
            version: apiVersion,
        };

        components.forEach((component) => {
            const type = packageJson.types.find((type) => type.name === component.type);
            if (type) {
                // Add member to existing type
                type.members.push(component.fullName);
            } else {
                // create new type
                const newType = {
                    name: component.type,
                    members: [component.fullName],
                };
                packageJson.types.push(newType);
            }
        });

        const builder = new xml2js.Builder({
            xmldec: { version: '1.0', encoding: 'UTF-8' },
        });

        let packageObj = {
            Package: packageJson,
        };

        packageManifest._manifestXml = builder.buildObject(packageObj);
        packageManifest._manifestJson = packageObj;

        return packageManifest;
    }

    /**
     * Factory method
     * @param manifest package JSON
     * @returns instance of PackageManifest
     */
    static async createWithJSONManifest(manifest: any): Promise<PackageManifest> {
        const packageManifest = new PackageManifest();
        packageManifest._manifestJson = manifest;

        const builder = new xml2js.Builder({
            xmldec: { version: '1.0', encoding: 'UTF-8' },
        });

        packageManifest._manifestXml = builder.buildObject(manifest);

        return packageManifest;
    }

    /**
     *
     * @returns true or false, for whether there are profiles
     */
    public isProfilesInPackage(): boolean {
        let isProfilesFound = false;

        if (this._manifestJson.Package.types) {
            if (Array.isArray(this._manifestJson.Package.types)) {
                for (const type of this._manifestJson.Package.types) {
                    if (type.name === 'Profile') {
                        isProfilesFound = true;
                        break;
                    }
                }
            } else if (this.manifestJson.Package.types.name === 'Profile') {
                isProfilesFound = true;
            }
        }

        return isProfilesFound;
    }

    /**
     *
     * @returns true or false, for whether there are profiles
     */
     public isPermissionSetsInPackage(): boolean {
        let isPermissionSetFound = false;

        if (this._manifestJson.Package.types) {
            if (Array.isArray(this._manifestJson.Package.types)) {
                for (const type of this._manifestJson.Package.types) {
                    if (type.name === 'PermissionSet') {
                        isPermissionSetFound = true;
                        break;
                    }
                }
            } else if (this.manifestJson.Package.types.name === 'PermissionSet') {
                isPermissionSetFound = true;
            }
        }

        return isPermissionSetFound;
    }

    public isPermissionSetGroupsFoundInPackage(): boolean {
        let isPermissionSetGroupFound = false;
        if (Array.isArray(this._manifestJson?.Package?.types)) {
            for (let type of this._manifestJson.Package.types) {
                if (type.name === 'PermissionSetGroup') {
                    isPermissionSetGroupFound = true;
                    break;
                }
            }
        } else if (this._manifestJson?.Package?.types?.name === 'PermissionSetGroup') {
            isPermissionSetGroupFound = true;
        }
        return isPermissionSetGroupFound;
    }

    /**
     *
     * @returns true or false, for whether there are Apex classes and/or triggers
     */
    public isApexInPackage(): boolean {
        let isApexFound = false;

        if (this._manifestJson.Package.types) {
            if (Array.isArray(this._manifestJson.Package.types)) {
                for (const type of this._manifestJson.Package.types) {
                    if (type.name === 'ApexClass' || type.name === 'ApexTrigger') {
                        isApexFound = true;
                        break;
                    }
                }
            } else if (
                this._manifestJson.Package.types.name === 'ApexClass' ||
                this._manifestJson.Package.types.name === 'ApexTrigger'
            ) {
                isApexFound = true;
            }
        }

        return isApexFound;
    }

    /**
     *
     * @returns Apex triggers if there are any, otherwise returns undefined
     */
    public fetchTriggers(): ApexClasses {
        let triggers: string[];

        let types;
        if (this._manifestJson.Package.types) {
            if (this._manifestJson.Package.types instanceof Array) {
                types = this._manifestJson.Package.types;
            } else {
                // Create array with single type
                types = [this._manifestJson.Package.types];
            }
        }

        if (types) {
            for (const type of types) {
                if (type.name === 'ApexTrigger') {
                    if (type.members instanceof Array) {
                        triggers = type.members;
                    } else {
                        // Create array with single member
                        triggers = [type.members];
                    }
                    break;
                }
            }
        }

        return triggers;
    }

    public isPayloadContainTypesOtherThan(providedType: string): boolean {
        let anyOtherType = false;
        if (this._manifestJson.Package.types) {
            if (Array.isArray(this._manifestJson.Package.types)) {
                for (const type of this._manifestJson.Package.types) {
                    if (type.name !== providedType) {
                        anyOtherType = true;
                        break;
                    }
                }
            } else if (this._manifestJson.Package.types.name !== providedType) {
                anyOtherType = true;
            }
        }
        return anyOtherType;
    }

    public isPayLoadContainTypesSupportedByProfiles(): boolean {
        const profileSupportedMetadataTypes = [
            'ApexClass',
            'CustomApplication',
            'CustomObject',
            'CustomField',
            'Layout',
            'ApexPage',
            'CustomTab',
            'RecordType',
            'SystemPermissions',
        ];

        let containsProfileSupportedType = false;
        if (this._manifestJson.Package.types) {
            if (Array.isArray(this._manifestJson.Package.types)) {
                for (const type of this._manifestJson.Package.types) {
                    if (profileSupportedMetadataTypes.includes(type.name)) {
                        containsProfileSupportedType = true;
                        break;
                    }
                }
            } else if (profileSupportedMetadataTypes.includes(this._manifestJson.Package.types.name)) {
                containsProfileSupportedType = true;
            }
        }
        return containsProfileSupportedType;
    }
}
