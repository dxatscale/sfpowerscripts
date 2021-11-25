import Component from "./Component";

export default interface DependencyViolation {
  component: Component,
  dependency: any,
  description: string
}