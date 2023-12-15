import { PackageType } from "../package/SfpPackage";

/**
 * Component details and package it belongs to
 */
export default interface Component {
    id: string;
    fullName: string;
    type: string;
    files?: string[];
    package?: string;
    packageType?: PackageType;
    indexOfPackage?: number;
    namespace?: string;
    dependencies?: Component[];
}
