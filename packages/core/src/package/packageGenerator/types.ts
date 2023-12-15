import {NamedPackageDir,PackageDirDependency} from '@salesforce/core'

export interface NamedPackageDirLarge extends NamedPackageDir {
    ignoreOnStage?: string[]
    postDeploymentScript?: string
    preDeploymentScript?: string
    type?: string
  }
  
  export type PackageCharacter = {
    hasDepsChanges: boolean
    hasManagedPckDeps: boolean
    job?: string
    reason: string
    tag?: string
    type: string
    versionNumber: string
    packageDeps: PackageDirDependency[],
    packageId: string,
    path: string,
    buildDeps: string[],
    hasError: boolean,
    errorMessages: string,
    branch?: string,
    configFilePath?: string,
    subscriberPackageId: string,
  }

  export type PackageOutput = {
    packageVersionNumber?: string
    packageVersionId?: string
    packageTestCoverage?: string
    coveragePassed?: boolean
    metadataCount?: number
    apexInPackage?: boolean
    profilesInPackage?: boolean
    commitId?: string
  }
  
  export type YamlFileTemplate = {
    includeOnlyArtifacts: string[]
  }