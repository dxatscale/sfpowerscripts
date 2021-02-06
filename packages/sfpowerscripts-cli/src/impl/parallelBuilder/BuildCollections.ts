import UndirectedGraph from "./UndirectedGraph";
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";


/**
 * Class for the manipulation of package build collections
 */
export default class BuildCollections {
  // Disconnected undirected graph is used to represent collections and their packages
  private _graph: UndirectedGraph;

  constructor(projectDirectory: string) {
    this.createGraphOfBuildCollections(projectDirectory);
  }

  get graph(): UndirectedGraph {
    return this._graph;
  }

  /**
   * Constructs graph representation of collections
   * @param projectDirectory
   */
  private createGraphOfBuildCollections(projectDirectory: string) {
    this._graph = new UndirectedGraph();

    let projectConfig = ProjectConfig.getSFDXPackageManifest(projectDirectory);
    for (let pkg of projectConfig.packageDirectories) {
      if (pkg.buildCollection) {
        if (pkg.buildCollection instanceof Array) {
          if (!this._graph.adjacencyList[pkg.package])
            this._graph.addVertex(pkg.package);

          pkg.buildCollection.forEach((packageInCollection) => {
            // Create vertex for package in collection if it doesn't exist yet
            if (!this._graph.adjacencyList[packageInCollection]) {
              // Verify that the package in collection is a valid package, before adding to adj. list
              if (
                projectConfig.packageDirectories.find((elem) => elem.package === packageInCollection)
              ) {
                this._graph.addVertex(packageInCollection);
              } else
                throw new Error(`Package '${packageInCollection}' in collection ${pkg.buildCollection} is not a valid package`);
            }

            this._graph.addEdge(pkg.package, packageInCollection);
          });
        } else throw new Error(`Property 'buildCollection' must be of type Array. Received ${pkg.buildCollection}`);
      }
    }
  }

  /**
   * Returns list of packages contained in the same collection as the package
   * @param pkg
   */
  listPackagesInCollection(pkg: string): string[] {
    return this._graph.dfs(pkg)
  }

  isPackageInACollection(pkg: string): boolean {
    return this._graph.adjacencyList[pkg] ? true : false;
  }
}
