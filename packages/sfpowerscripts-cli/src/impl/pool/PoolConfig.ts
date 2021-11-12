import ScratchOrg from "@dxatscale/sfpowerscripts.core/lib/scratchorg/ScratchOrg";

export interface PoolConfig {
  tag: string,
  maxAllocation: number,
  expiry?: number,
  batchSize?: number,
  configFilePath: string,
  succeedOnDeploymentErrors?: boolean,
  keys?: string,
  installAll: boolean,
  enableSourceTracking: boolean,
  relaxAllIPRanges?:boolean,
  ipRangesToBeRelaxed?:[],
  retryOnFailure?:boolean,
  fetchArtifacts: {
    artifactFetchScript?: string,
    npm?: {
      npmrcPath?:string,
      scope: string
    }
  },
  enableVlocity?:boolean,
  min_allocation?: number;
  current_allocation?: number;
  to_allocate?: number;
  to_satisfy_min?: number;
  to_satisfy_max?: number;
  scratchOrgs?: ScratchOrg[];
  failedToCreate?:number;
}
