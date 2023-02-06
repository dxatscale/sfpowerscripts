/**
 * Converts build-number dot delimeter to hyphen
 * If dot delimeter does not exist, returns input
 * @param version
 */
export default function convertBuildNumDotDelimToHyphen(version: string) {
    let convertedVersion = version;

    let indexOfBuildNumDelimiter = getIndexOfBuildNumDelimeter(version);
    if (version[indexOfBuildNumDelimiter] === '.') {
        convertedVersion =
            version.substring(0, indexOfBuildNumDelimiter) + '-' + version.substring(indexOfBuildNumDelimiter + 1);
    }
    return convertedVersion;
}

/**
 * Get the index of the build-number delimeter
 * Returns null if unable to find index of delimeter
 * @param version
 */
function getIndexOfBuildNumDelimeter(version: string) {
    let numOfDelimetersTraversed: number = 0;
    for (let i = 0; i < version.length; i++) {
        if (!Number.isInteger(parseInt(version[i], 10))) {
            numOfDelimetersTraversed++;
        }
        if (numOfDelimetersTraversed === 3) {
            return i;
        }
    }
    return null;
}
