import { SFPPackage } from "../SFPPackage";

interface PropertyFetcher
{
  getSfpowerscriptsProperties(packageContents:SFPPackage, packageLogger?:any);
}


export namespace PropertyFetcher {
  type Constructor<T> = {
    new (...args: any[]): T;
    readonly prototype: T;
  };
  const implementations: Constructor<PropertyFetcher>[] = [];
  export function GetImplementations(): Constructor<PropertyFetcher>[] {
    return implementations;
  }
  export function register<T extends Constructor<PropertyFetcher>>(ctor: T) {
    implementations.push(ctor);
    return ctor;
  }
}