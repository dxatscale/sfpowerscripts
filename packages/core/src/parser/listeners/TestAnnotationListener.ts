import AnnotationListener from "./AnnotationListener";
import { AnnotationContext } from "apex-parser";

export default class TestAnnotationListener extends AnnotationListener {
  private testAnnotationCount: number = 0;

  protected enterAnnotation(ctx: AnnotationContext) {
    super.enterAnnotation(ctx);
    if (ctx._stop.text.toUpperCase() === "ISTEST") {
      this.testAnnotationCount += 1;
    }
  }

  public getTestAnnotationCount(): number {
    return this.testAnnotationCount;
  }
}
