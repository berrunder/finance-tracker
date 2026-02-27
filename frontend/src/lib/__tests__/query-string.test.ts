import { buildQueryString, buildSearchParams } from '../query-string'

describe('buildSearchParams', () => {
    it('skips undefined and empty string values', () => {
        const params = buildSearchParams({
            q: 'coffee',
            empty: '',
            missing: undefined,
        })

        expect(params.toString()).toBe('q=coffee')
    })

    it('appends each non-empty array value and skips empty ones', () => {
        const params = buildSearchParams({
            tag: ['food', '', 'travel', undefined],
        })

        expect(params.getAll('tag')).toEqual(['food', 'travel'])
        expect(params.toString()).toBe('tag=food&tag=travel')
    })

    it('serializes scalar values as strings', () => {
        const params = buildSearchParams({
            page: 2,
            includeArchived: false,
            minAmount: 0,
        })

        expect(params.toString()).toBe('page=2&includeArchived=false&minAmount=0')
    })
})

describe('buildQueryString', () => {
    it('returns an empty string when there are no effective params', () => {
        expect(buildQueryString({ q: '', tag: [] as string[], page: undefined })).toBe(
            '',
        )
    })

    it('returns a prefixed query string when params exist', () => {
        expect(buildQueryString({ q: 'rent', type: ['expense', 'income'] })).toBe(
            '?q=rent&type=expense&type=income',
        )
    })
})