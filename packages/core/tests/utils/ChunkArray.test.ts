import { expect } from '@jest/globals';
import { chunkArray } from '../../src/utils/ChunkArray';

describe('Given an input array', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    it('should chunk for even chunk size', () => {
        const result = chunkArray(2, input);
        expect(result.length).toBe(5);
        expect(result).toEqual([
            [1, 2],
            [3, 4],
            [5, 6],
            [7, 8],
            [9, 10],
        ]);
    });

    it('should chunk for odd chunk size', () => {
        const result = chunkArray(3, input);
        expect(result.length).toBe(4);
        expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]);
    });
});
