import ScratchOrg from "./ScratchOrg";

export interface Pool {
  expiry: number;
  config_file_path: string;
  script_file_path?: string;
  tag: string;
  max_allocation: number;
  min_allocation?: number;
  current_allocation?: number;
  to_allocate?: number;
  to_satisfy_min?: number;
  to_satisfy_max?: number;
  scratchOrgs?: ScratchOrg[];
  failedToCreate?:number;
}

