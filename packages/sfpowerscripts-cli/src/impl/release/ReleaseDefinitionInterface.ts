export default interface ReleaseDefinition {
  release: string,
  artifacts: {
    [p: string]: string
  }
}
