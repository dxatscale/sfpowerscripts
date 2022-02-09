export interface PoolError
{
  success: number,
  failed: number,
  errorCode: PoolErrorCodes,
  message?:string
}


export enum PoolErrorCodes {
  Max_Capacity = "MaxCapacity",
  No_Capacity = "NoCapacity",
  PrerequisiteMissing = "PrerequisitesMissing",
  UnableToProvisionAny = "UnableToProvisionAny"
}