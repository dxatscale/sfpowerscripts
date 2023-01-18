import FHTAnalyser from './FHTAnalyzer';
import FTAnalyser from './FTAnalyzer';
import { PackageAnalyzer } from './PackageAnalyzer';

export class AnalyzerRegistry {
    static getAnalyzers(): PackageAnalyzer[] {
        let packageAnalyzers: PackageAnalyzer[] = [];

        //TODO: Make dynamic
        let fhtAnalyzer = new FHTAnalyser();
        let ftAnalyser = new FTAnalyser();
        packageAnalyzers.push(fhtAnalyzer);
        packageAnalyzers.push(ftAnalyser);

        return packageAnalyzers;
    }
}
