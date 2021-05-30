import  SFPPackage  from "../../../src/package/SFPPackage";
import PackageTestCoverage from "../../../src/package/coverage/PackageTestCoverage"

import { jest, expect } from "@jest/globals";


let packageType="Unlocked";
jest.mock("../../../src/package/SFPPackage",()=>{
   class SFPPackage
   {
     get apexClassWithOutTestClasses()
     {
       return new Array<string>("CustomerServices","MarketServices")
     }
     get triggers()
     {
       return null
     }
     get packageType()
     {
       return packageType;
     }

     static async buildPackageFromProjectConfig( projectDirectory: string,
      sfdx_package: string,
      configFilePath?: string,
      packageLogger?: any):Promise<SFPPackage>
      {
        return new SFPPackage();
      }
   }
   return SFPPackage;
})


describe("Given a sfpowerscripts package andcode coverage report, a package coverage calculator",()=>{

  it("should be able to provide the coverage of a provided unlocked package",async ()=>{  
         let sfpPackage:SFPPackage = await SFPPackage.buildPackageFromProjectConfig(null,"es-base-code",null,null);
         let packageTestCoverage:PackageTestCoverage = new PackageTestCoverage(sfpPackage,succesfulTestCoverage);
         expect (packageTestCoverage.getCurrentPackageTestCoverage()).toBe(88);
  });


  it("should able to validate whether the coverage of unlocked  package is above a certain threshold",async ()=>{  
    let sfpPackage:SFPPackage = await SFPPackage.buildPackageFromProjectConfig(null,"es-base-code",null,null);
    let packageTestCoverage:PackageTestCoverage = new PackageTestCoverage(sfpPackage,succesfulTestCoverage);
    let requiredCoverage=80;
    let result=packageTestCoverage.validateTestCoverage(requiredCoverage);
    expect (result.result).toBe(true);
    expect (result.packageTestCoverage).toBe(88);
    expect (result.message).toStrictEqual(`Package overall coverage is greater than ${requiredCoverage}%`);
    expect(result.classesCovered).toStrictEqual([
      { name: 'CustomerServices', coveredPercent: 87.09677419354838 },
      { name: 'MarketServices', coveredPercent: 100 }
    ]);
    expect(result.classesWithInvalidCoverage).toBeUndefined();  
});

it("should able to validate whether the coverage of unlocked  package is above mandatory threshold",async ()=>{  
  let sfpPackage:SFPPackage = await SFPPackage.buildPackageFromProjectConfig(null,"es-base-code",null,null);
  let packageTestCoverage:PackageTestCoverage = new PackageTestCoverage(sfpPackage,succesfulTestCoverage);
  let requiredCoverage=75;
  let result=packageTestCoverage.validateTestCoverage();
  expect (result.result).toBe(true);
  expect (result.packageTestCoverage).toBe(88);
  expect (result.message).toStrictEqual(`Package overall coverage is greater than ${requiredCoverage}%`);
  expect(result.classesCovered).toStrictEqual([
    { name: 'CustomerServices', coveredPercent: 87.09677419354838 },
    { name: 'MarketServices', coveredPercent: 100 }
  ]);
  expect(result.classesWithInvalidCoverage).toBeUndefined();  
});


it("should be able to provide the coverage of a provided source package",async ()=>{  
  packageType="Source";
  let sfpPackage:SFPPackage = await SFPPackage.buildPackageFromProjectConfig(null,"es-base-code",null,null);
  let packageTestCoverage:PackageTestCoverage = new PackageTestCoverage(sfpPackage,succesfulTestCoverage);
  expect (packageTestCoverage.getCurrentPackageTestCoverage()).toBe(88);
});


it("should able to validate whether the coverage of source  package is above a certain threshold",async ()=>{  
  packageType="Source";
  let sfpPackage:SFPPackage = await SFPPackage.buildPackageFromProjectConfig(null,"es-base-code",null,null);
  let packageTestCoverage:PackageTestCoverage = new PackageTestCoverage(sfpPackage,succesfulTestCoverage);
  let requiredCoverage=80;
  let result=packageTestCoverage.validateTestCoverage(requiredCoverage);
  expect (result.result).toBe(true);
  expect (result.packageTestCoverage).toBe(88);
  expect (result.message).toStrictEqual(`Individidual coverage of classes is greater than ${requiredCoverage}%`);
  expect(result.classesCovered).toStrictEqual([
    { name: 'CustomerServices', coveredPercent: 87.09677419354838 },
    { name: 'MarketServices', coveredPercent: 100 }
  ]);
  expect(result.classesWithInvalidCoverage).toBeUndefined();  
});


it("should able to validate whether the coverage of source  package is above mandatory threshold",async ()=>{  
  packageType="Source";
  let sfpPackage:SFPPackage = await SFPPackage.buildPackageFromProjectConfig(null,"es-base-code",null,null);
  let packageTestCoverage:PackageTestCoverage = new PackageTestCoverage(sfpPackage,succesfulTestCoverage);
  let requiredCoverage=75;
  let result=packageTestCoverage.validateTestCoverage();
  expect (result.result).toBe(true);
  expect (result.packageTestCoverage).toBe(88);
  expect (result.message).toStrictEqual(`Individidual coverage of classes is greater than ${requiredCoverage}%`);
  expect(result.classesCovered).toStrictEqual([
    { name: 'CustomerServices', coveredPercent: 87.09677419354838 },
    { name: 'MarketServices', coveredPercent: 100 }
  ]);
  expect(result.classesWithInvalidCoverage).toBeUndefined();  
});

});


let succesfulTestCoverage=[
  {
      "id": "01p0w000001n1SdAAI",
      "name": "CustomerServices",
      "totalLines": 31,
      "lines": {
          "3": 1,
          "4": 1,
          "5": 1,
          "13": 1,
          "15": 1,
          "16": 1,
          "17": 1,
          "18": 1,
          "19": 1,
          "20": 1,
          "21": 1,
          "22": 1,
          "25": 1,
          "31": 1,
          "34": 1,
          "37": 1,
          "40": 1,
          "43": 0,
          "46": 0,
          "49": 1,
          "57": 1,
          "58": 1,
          "59": 1,
          "60": 1,
          "61": 1,
          "62": 1,
          "63": 1,
          "64": 1,
          "65": 0,
          "66": 1,
          "67": 0
      },
      "totalCovered": 27,
      "coveredPercent": 87.09677419354838
  },
  {
      "id": "01p0w000001n1SfAAI",
      "name": "MarketServices",
      "totalLines": 3,
      "lines": {
          "3": 1,
          "4": 1,
          "16": 1
      },
      "totalCovered": 3,
      "coveredPercent": 100
  }
]