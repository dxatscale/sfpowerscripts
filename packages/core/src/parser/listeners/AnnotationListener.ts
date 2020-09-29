import { ApexParserListener, AnnotationContext } from "apex-parser";

export default class AnnotationListener implements ApexParserListener {
  private annotationCount: number = 0;

  protected enterAnnotation(ctx: AnnotationContext) {
    this.annotationCount += 1;
  }

  private exitAnnotation(ctx: AnnotationContext) {
    // Perform some logic
  }

  public getAnnotationCount(): number {
    return this.annotationCount;
  }
}
