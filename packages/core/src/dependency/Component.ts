/**
 * Component details and package it belongs to
 */
export default interface Component {
  id: string,
  fullName: string,
  type: string,
  files?: string[],
  package?: string,
  packageType?: "Unlocked" | "Data" | "Source",
  indexOfPackage?: number,
  namespace?: string,
  dependencies?: Component[]
}