import { expect } from '@jest/globals';
import UndirectedGraph from '../../../src/impl/parallelBuilder/UndirectedGraph';

describe('Given an Undirected Graph class', () => {
    it('should initialise with an empty adjacency list', () => {
        let graph = new UndirectedGraph();
        expect(graph.adjacencyList).toEqual({});
    });

    it('should be able to add new vertices', () => {
        let graph = new UndirectedGraph();
        graph.addVertex('A');
        expect(graph.adjacencyList.A).toEqual([]);
    });

    it('should throw an error if adding a vertex that already exists', () => {
        let graph = new UndirectedGraph();
        graph.addVertex('A');
        expect(() => {
            graph.addVertex('A');
        }).toThrow();
    });

    it('should be able to add a bi-directional edge between two vertices', () => {
        let graph = new UndirectedGraph();
        graph.addVertex('A');
        graph.addVertex('B');
        graph.addEdge('A', 'B');
        expect(graph.adjacencyList).toEqual({ A: ['B'], B: ['A'] });
    });

    it('should throw an error if adding an edge between vertices that do not exist', () => {
        let graph = new UndirectedGraph();
        graph.addVertex('A');
        graph.addVertex('B');

        expect(() => {
            graph.addEdge('A', 'C');
        }).toThrow();
        expect(() => {
            graph.addEdge('C', 'A');
        }).toThrow();
        expect(() => {
            graph.addEdge('C', 'D');
        }).toThrow();
    });

    it('should throw an error if adding an edge to a single vertex', () => {
        let graph = new UndirectedGraph();
        graph.addVertex('A');

        expect(() => {
            graph.addEdge('A', 'A');
        }).toThrow();
    });

    it('should be able to list the vertices in a graph, using depth-first search from a given vertex', () => {
        let graph = new UndirectedGraph();
        graph.addVertex('A');
        graph.addVertex('B');
        graph.addVertex('C');
        graph.addVertex('D');
        graph.addVertex('E');
        graph.addVertex('F');

        graph.addEdge('A', 'B');
        graph.addEdge('A', 'C');
        graph.addEdge('B', 'D');
        graph.addEdge('C', 'E');
        graph.addEdge('D', 'E');
        graph.addEdge('D', 'F');
        graph.addEdge('E', 'F');

        //          A
        //        /   \
        //       B     C
        //       |     |
        //       D --- E
        //        \   /
        //          F

        expect(graph.dfs('F')).toEqual(['F', 'D', 'B', 'A', 'C', 'E']);
        expect(graph.dfs('C')).toEqual(['C', 'A', 'B', 'D', 'E', 'F']);
        expect(graph.dfs('A')).toEqual(['A', 'B', 'D', 'E', 'C', 'F']);
    });

    it('should throw an error when attempting to perform dfs from a non-existent vertex', () => {
        let graph = new UndirectedGraph();
        expect(() => {
            graph.dfs('A');
        }).toThrowError("Vertex 'A' does not exist");
    });
});
