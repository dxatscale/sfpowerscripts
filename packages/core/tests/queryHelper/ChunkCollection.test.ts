import { expect } from '@jest/globals';
import chunkCollection from '../../src/queryHelper/ChunkCollection';

describe('Given a collection', () => {

    it('should return a single chunk for a collection less than 3000 chars', () => {
        const collection = ["ApexClassA", "ApexClassB", "ApexClassC"];
        const result = chunkCollection(collection);
        expect(result.length).toBe(1);
        expect(result).toEqual([
            ["ApexClassA", "ApexClassB", "ApexClassC"]
        ]);
    });


    it('should return N chunks for a collection exceeding the chunk size', () => {
        const collection = ["ApexClassA", "ApexClassB", "ApexClassC", "ApexClassD"];
        const result = chunkCollection(collection, 1050, 1000);
        expect(result.length).toBe(2);
        expect(result).toEqual([
            ["ApexClassA", "ApexClassB", "ApexClassC"],
            ["ApexClassD"]
        ]);
    });

    it('should throw an error if single element in collection exceeds chunk size', () => {
        const collection = ["ApexClassWithAnExceedinglyLongNameGreaterThanTheChunkSize"];
        expect(() => {chunkCollection(collection, 1050, 1000)}).toThrow();
    });
});
