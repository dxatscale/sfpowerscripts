import Component from "./Component";

/**
 * Used by sfdc-soup API calls
 */
export default interface Entrypoint {
  name: string,
  type: string,
  id: string
}

export function component2entrypoint(components: Component[]): Entrypoint[] {
  return components.map(component => {
    return {
      name: component.fullName,
      type: component.type,
      id: component.id
    } as Entrypoint
  });
}