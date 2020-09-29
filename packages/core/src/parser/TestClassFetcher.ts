import fs from "fs-extra";
const path = require("path");
const glob = require("glob");

import { CommonTokenStream,  ANTLRInputStream } from 'antlr4ts';
import { ParseTreeWalker } from "antlr4ts/tree/ParseTreeWalker";

import TestAnnotationListener from "./listeners/TestAnnotationListener";

import {
  ApexLexer,
  ApexParser,
  ApexParserListener,
  ThrowingErrorListener
} from "apex-parser";

export default class TestClassFetcher {
  public unparsedClasses: string[];

  constructor() {
    this.unparsedClasses = [];
  }

  /**
   * Get name of test classes in a search directory.
   * An empty array is returned if no test classes are found.
   * @param searchDir
   */
  public getTestClassNames(searchDir: string): string[] {
    const testClassNames: string[] = [];

    let clsFiles: string[];
    if (fs.existsSync(searchDir)) {
      clsFiles = glob.sync(`*.cls`, {
        cwd: searchDir,
        absolute: true
      });
    } else {
      throw new Error(`Search directory ${searchDir} does not exist`);
    }

    for (let clsFile of clsFiles) {

      let clsPayload: string = fs.readFileSync(clsFile, 'utf8');

      let compilationUnitContext;
      try {
        let lexer = new ApexLexer(new ANTLRInputStream(clsPayload));
        let tokens: CommonTokenStream  = new CommonTokenStream(lexer);

        let parser = new ApexParser(tokens);
        parser.removeErrorListeners()
        parser.addErrorListener(new ThrowingErrorListener());

        compilationUnitContext = parser.compilationUnit();

      } catch (err) {
        console.log(`Failed to parse ${clsFile}`);
        console.log(err);
        this.unparsedClasses.push(path.basename(clsFile, ".cls"));
        continue;
      }

      let testAnnotationListener: TestAnnotationListener = new TestAnnotationListener();

      ParseTreeWalker.DEFAULT.walk(testAnnotationListener as ApexParserListener, compilationUnitContext);

      if (testAnnotationListener.getTestAnnotationCount() > 0) {
        let className: string = path.basename(clsFile, ".cls");
        testClassNames.push(className);
      }
    }

    return testClassNames;
  }
}
