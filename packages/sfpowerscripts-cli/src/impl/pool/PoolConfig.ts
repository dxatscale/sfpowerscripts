import ScratchOrg from "@dxatscale/sfpowerscripts.core/src/scratchorg/ScratchOrg";

export interface PoolConfig {
  tag: string,
  maxallocation: number,
  expiry?: number,
  batchsize?: number,
  configFilePath: string,
  succeedOnDeploymentErrors?: boolean,
  keys?: string,
  cipool?: {
    installAll: boolean,
    installAsSourcePackages: boolean,
    retryOnFailure?:boolean,
    fetchArtifacts: {
      artifactFetchScript?: string,
      npm?: {
        npmrcPath?:string,
        scope?: string,
        npmtag?: string
      }
    }
  },
  devpool?: {
    scriptToExecute?: string,
    pushSource?: boolean,
    relaxAllIPRanges?:boolean,
    ipRangesToBeRelaxed?:[]
  },
  min_allocation?: number;
  current_allocation?: number;
  to_allocate?: number;
  to_satisfy_min?: number;
  to_satisfy_max?: number;
  scratchOrgs?: ScratchOrg[];
  failedToCreate?:number;
}

