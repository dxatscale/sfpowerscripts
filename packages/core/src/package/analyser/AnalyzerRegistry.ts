import FHTAnalyser from './FHTAnalyzer';
import FTAnalyser from './FTAnalyzer';
import { PackageAnalyzer } from './PackageAnalyzer';
import PicklistAnalyzer from './PicklistAnalyzer';

export class AnalyzerRegistry {
    static getAnalyzers(): PackageAnalyzer[] {
        let packageAnalyzers: PackageAnalyzer[] = [];

        //TODO: Make dynamic
        let fhtAnalyzer = new FHTAnalyser();
        let ftAnalyser = new FTAnalyser();
        let picklistAnalyzer = new PicklistAnalyzer();
        packageAnalyzers.push(fhtAnalyzer);
        packageAnalyzers.push(ftAnalyser);
        packageAnalyzers.push(picklistAnalyzer);

        return packageAnalyzers;
    }
}
