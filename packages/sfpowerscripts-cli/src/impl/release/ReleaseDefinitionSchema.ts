export default interface ReleaseDefinitionSchema {
  release: string,
  artifacts: {
    [p: string]: string
  },
  packageDependencies: {
    [p: string]: string
  },
  releaseOptions: {
    skipIfAlreadyInstalled: boolean
    baselineOrg: string
  }
}
