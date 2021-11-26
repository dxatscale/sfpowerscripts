/**
 * Component details and package it belongs to
 */
export default interface Component {
  id: string,
  fullName: string,
  type: string,
  files?: string[],
  package?: string,
  indexOfPackage?: number,
  namespace?: string,
  dependencies?: Component[]
}