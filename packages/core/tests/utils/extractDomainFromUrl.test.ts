import { expect } from '@jest/globals';
import extractDomainFromUrl from '../../src/utils/extractDomainFromUrl';

describe('Given a URL', () => {
    it('should extract the domain name for https', () => {
        expect(extractDomainFromUrl('https://force-power-8147.cs115.my.salesforce.com')).toBe(
            'force-power-8147.cs115.my.salesforce.com'
        );
    });

    it('should extract the domain name for http', () => {
        expect(extractDomainFromUrl('https://force-power-8147.cs115.my.salesforce.com')).toBe(
            'force-power-8147.cs115.my.salesforce.com'
        );
    });

    it('should extract only the domain name', () => {
        expect(
            extractDomainFromUrl(
                'https://company.lightning.force.com/lightning/o/Account/list?filterName=00B4Y000000VyMDUA0'
            )
        ).toBe('company.lightning.force.com');
    });

    it('should return null for protocol other than http/s', () => {
        expect(extractDomainFromUrl('ftp://ftp.example.com/files/fileA')).toBe(null);
    });

    it('should return input for falsy values', () => {
        expect(extractDomainFromUrl('')).toBe('');
        expect(extractDomainFromUrl(undefined)).toBe(undefined);
        expect(extractDomainFromUrl(null)).toBe(null);
    });
});
