export interface Changelog {
  name: string,
  from: string,
  to: string,
  commits: Commit[]
}

export interface Commit {
    commitId: string,
    date: string,
    author: string,
    message: string,
    body: string
}
