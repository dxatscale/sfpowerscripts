export interface Changelog {
    /**
     * Name of the package
     */
    name: string;

    /**
     * Backwards-compatibility for delta package
     */
    from: string;

    /**
     * Commit Id from which package was created
     * May not necessarily be the first element in commits
     */
    to: string;

    /**
     * Commits that modified the package
     */
    commits: Commit[];
}

export interface Commit {
    commitId: string;
    date: string;
    author: string;
    message: string;
    body: string;
}
