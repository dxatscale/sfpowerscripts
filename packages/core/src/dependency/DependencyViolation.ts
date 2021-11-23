import Component from "./Component";

export default interface DependencyViolation {
  package: string,
  indexOfPackage: number,
  files: string[],
  fullName: string,
  type: string,
  dependency: Component,
  description: string
}