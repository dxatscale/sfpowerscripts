import FHTAnalyser from './FHTAnalyzer';
import { PackageAnalyzer } from './PackageAnalyzer';

export class AnalyzerRegistry {
    static getAnalyzers(): PackageAnalyzer[] {
        let packageAnalyzers: PackageAnalyzer[] = [];

        //TODO: Make dynamic
        let fhtAnalzer = new FHTAnalyser();
        packageAnalyzers.push(fhtAnalzer);

        return packageAnalyzers;
    }
}
