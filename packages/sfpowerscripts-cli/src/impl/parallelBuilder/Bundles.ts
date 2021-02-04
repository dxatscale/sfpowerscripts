import UndirectedGraph from "./UndirectedGraph"
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig"


/**
 * Class for the manipulation of package bundles
 */
export default class Bundles {
  // Disconnected undirected graph is used to represent bundles and their packages
  private graph: UndirectedGraph;

  constructor(projectDirectory: string) {
    this.createGraphOfBundles(projectDirectory);
  }

  /**
   * Constructs graph representation of bundles
   * @param projectDirectory
   */
  private createGraphOfBundles(projectDirectory: string) {
    this.graph = new UndirectedGraph();

    let projectConfig = ProjectConfig.getSFDXPackageManifest(projectDirectory);

    for (let pkg of projectConfig.packageDirectories) {
      if (pkg.bundle) {
        if (pkg.bundle instanceof Array) {
          if (!this.graph.adjacencyList[pkg.package])
            this.graph.addVertex(pkg.package);

          pkg.bundle.forEach((bundledPackage) => {
            // Create vertex for bundled package it doesn't exist yet
            if (!this.graph.adjacencyList[bundledPackage]) {
              // Verify that the bundled package is a valid package, before adding to adj. list
              if (
                projectConfig.packageDirectories.find((elem) => elem.package === bundledPackage)
              ) {
                this.graph.addVertex(bundledPackage);
              } else
                throw new Error(`Package '${bundledPackage}' in bundle ${pkg.bundle} is not a valid package`);
            }

            this.graph.addEdge(pkg.package, bundledPackage);
          });
        } else throw new Error(`Property 'bundle' must be of type Array. Received ${pkg.bundle}`);
      }
    }
  }

  /**
   * Returns list of packages contained in the same bundle as the package
   * @param pkg
   */
  listPackagesBundledWith(pkg: string): string[] {
    return this.graph.dfs(pkg)
  }

  isPackagePartOfABundle(pkg: string): boolean {
    return this.graph.adjacencyList[pkg] ? true : false;
  }
}
