import { ApexParserListener, InterfaceDeclarationContext } from "apex-parser";

export default class InterfaceDeclarationListener
  implements ApexParserListener {
  private interfaceDeclarationCount: number = 0;

  private enterInterfaceDeclaration(ctx: InterfaceDeclarationContext) {
    this.interfaceDeclarationCount += 1;
  }

  private exitInterfaceDeclaration(ctx: InterfaceDeclarationContext) {
    // Perform some logic
  }

  public getInterfaceDeclarationCount(): number {
    return this.interfaceDeclarationCount;
  }
}
