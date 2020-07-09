import * as path from 'path';
import fs from 'fs-extra';

export function findPackage(packageName, userDir) {

    let debug = false
    // if ( packageName === 'startbootstrap-sb-admin-2' ) {
    //     debug = true
    //     if (debug) console.debug(`\n[UIBUILDER] Looking for package ${packageName}`)
    // }
    
    let found = false, packagePath = ''
    // Try in userDir first
    try {
        packagePath = path.dirname( require.resolve(packageName, {paths: [userDir]}) )
        if (debug) console.log(`[UIBUILDER] ${packageName} found from userDir`, packagePath)
        found = true
    } catch (e) {
        if (debug) console.log (`[UIBUILDER] ${packageName} not found from userDir. Path: ${userDir}`)
    }
    // Then try without a path
    if (found === false) try {
        packagePath = path.dirname( require.resolve(packageName) )
        if (debug) console.log(`[UIBUILDER] ${packageName} found (no path)`, packagePath)
        found = true
    } catch (e) {
        if (debug) console.log (`[UIBUILDER] ${packageName} not found (no path)`)
    }
    // Finally try in the uibuilder source folder
    if (found === false) try {
        packagePath = path.dirname( require.resolve(packageName, {paths: [path.join(__dirname,'..')]}) )
        if (debug) console.log(`[UIBUILDER] ${packageName} found from uibuilder path`, packagePath)
        found = true
    } catch (e) {
        if (debug) console.log (`[UIBUILDER] ${packageName} not found from uibuilder path. Path: ${path.join(__dirname,'..')}`)
    }
    /** No, REALLY finally this time - because require.resolve only works if a package has a `main` entry point defined
     * We will make one final effort to find something using a manual trawl through <userDir>/node_modules
     * @since v2.0.3
     **/
    if (found === false) {
        let loc = path.join(userDir, 'node_modules', packageName)
        if ( fs.existsSync( loc ) ) {
            found = true
            packagePath = loc
            if (debug) console.log (`[UIBUILDER] ${packageName} not found from uibuilder path. Path: ${path.join(__dirname,'..')}`)
        } else {
            if (debug) console.log (`[UIBUILDER] ${packageName} not found from uibuilder path. Path: ${path.join(__dirname,'..')}`)
        }
    }

    if ( found === false ) {
        if (debug) console.log (`[UIBUILDER] ${packageName} not found anywhere\n`)
        return null
    }

    /** require.resolve returns the "main" script, this may not be in the root folder for the package
     *  so we change that here. We check whether the last element of the path matches the package
     *  name. If not, we walk back up the tree until it is or we run out of tree.
     *  If we don't do this, when it is used with serveStatic, we may not get everything we need served.
     * NB: Only assuming 3 levels here.
     * NB2: Added packageName split to allow for more complex npm package names.
     */
    let pathSplit = packagePath.split(path.sep)
    let packageLast = packageName.split('/').pop() // Allow for package names like `@riophae/vue-treeselect`
    if ( (pathSplit.length > 1) && (pathSplit[pathSplit.length - 1] !== packageLast) ) pathSplit.pop()
    if ( (pathSplit.length > 1) && (pathSplit[pathSplit.length - 1] !== packageLast) ) pathSplit.pop()
    if ( (pathSplit.length > 1) && (pathSplit[pathSplit.length - 1] !== packageLast) ) pathSplit.pop()
    packagePath = pathSplit.join(path.sep)

    if (debug) console.debug(`[UIBUILDER] PackagePath: ${packagePath}\n`)
    return packagePath
}