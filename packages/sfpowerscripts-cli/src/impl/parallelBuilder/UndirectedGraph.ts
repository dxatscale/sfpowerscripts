export default class UndirectedGraph {
  private _adjacencyList: {[p: string]: string[]};

  constructor () {
    this._adjacencyList = {};
  }

  get adjacencyList() {
    return this._adjacencyList;
  }

  addVertex(name: string) {
    if (!this._adjacencyList[name])
      this._adjacencyList[name] = [];
    else
      throw new Error(`Vertex with name '${name}' already exists`);
  }

  addEdge(vertexA: string, vertexB: string): void {
    if (vertexA === vertexB)
      throw new Error("Cannot add an edge to a single vertex");
    if(!this._adjacencyList[vertexA])
      throw new Error(`Vertex with name ${vertexA} does not exist`);
    if(!this._adjacencyList[vertexB])
      throw new Error(`Vertex with name ${vertexB} does not exist`);

    if(!this._adjacencyList[vertexA].includes(vertexB))
      this._adjacencyList[vertexA].push(vertexB);
    if(!this._adjacencyList[vertexB].includes(vertexA))
      this._adjacencyList[vertexB].push(vertexA);
  }

  /**
   * Returns vertices in graph, using depth-first search from the starting vertex
   * @param start
   */
  dfs(start: string): string[] {
    const vertices: string[] = [];
    const visited: {[p:string]: boolean} = {};
    const adjacencyList = this._adjacencyList;

    (function dfsHandler(vertex){
      if(!vertex) return null;
      if(!adjacencyList[vertex])
        throw new Error(`Vertex '${vertex}' does not exist`);
      visited[vertex] = true;
      vertices.push(vertex);
      adjacencyList[vertex].forEach(neighbor => {
          if(!visited[neighbor]){
              return dfsHandler(neighbor)
          }
      });
    })(start);

    return vertices;
  }
}
