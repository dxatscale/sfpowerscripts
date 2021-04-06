export default interface ReleaseDefinitionI {
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
