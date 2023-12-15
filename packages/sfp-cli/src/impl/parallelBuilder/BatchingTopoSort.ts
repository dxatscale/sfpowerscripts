import { AdjacentList } from './DependencyHelper';

export default class BatchingTopoSort {
    public sort(dag: AdjacentList) {
        try {
            const indegrees = this.countInDegrees(dag);
            let sorted = [];
            let roots = this.getRoots(indegrees);
            while (roots.length) {
                sorted.push(roots);
                let newRoots = [];
                roots.forEach((root) => {
                    dag[root].forEach((dependents) => {
                        indegrees[dependents]--;
                        if (indegrees[dependents] == 0) newRoots.push(dependents);
                    });
                });

                roots = newRoots;
            }

            if (this.getNonRoots(indegrees).length) {
                throw Error('Cycle(s) detected; toposort only works on acyclic graphs');
            }

            return sorted;
        } catch (error) {
            throw Error('Missing package in adjacency list or cycles detected' + error);
        }
    }

    private countInDegrees(dag: AdjacentList): DAGDegrees {
        let counts: DAGDegrees = {};
        Object.entries(dag).forEach(([key, dependents]) => {
            counts[key] = counts[key] || 0;
            dependents.forEach((dependent) => {
                counts[dependent] = counts[dependent] || 0;
                counts[dependent]++;
            });
        });
        return counts;
    }

    private getRoots(counts: DAGDegrees) {
        return Object.entries(counts)
            .filter(([key, degree]) => {
                if (degree == 0) return true;
            })
            .map(([key, degree]) => key);
    }

    private getNonRoots(counts: DAGDegrees) {
        return Object.entries(counts)
            .filter(([key, degree]) => {
                if (degree != 0) return true;
            })
            .map(([key, degree]) => key);
    }
}

type DAGDegrees = {
    [key: string]: number;
};
