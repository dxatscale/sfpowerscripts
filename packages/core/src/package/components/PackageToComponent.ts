import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import Component from '../../dependency/Component';


export default class PackageToComponent {
    public constructor(private packageName:string,private packageDirectory:string) {}

    public generateComponents() {
        const components: Component[] = [];

        let componentSet = ComponentSet.fromSource(this.packageDirectory);

        let componentSetArray = componentSet.getSourceComponents().toArray();

        for (const individualComponentFromComponentSet of componentSetArray) {
            const component: Component = {
                id: undefined,
                fullName: individualComponentFromComponentSet.fullName,
                type: individualComponentFromComponentSet.type.name,
                files: [individualComponentFromComponentSet.xml],
                package: this.packageName,
            };
            components.push(component);
        }

       return components;
    }
}
