const secure = require('../utils/secureStorage')

jest.mock('expo-secure-store', () => {
    let store = {}
    return {
        ALWAYS_THIS_DEVICE_ONLY: 'ALWAYS_THIS_DEVICE_ONLY',
        setItemAsync: async (key, value) => {
            store[key] = value
            return Promise.resolve()
        },
        getItemAsync: async (key) => {
            return Promise.resolve(store[key] ?? null)
        },
        deleteItemAsync: async (key) => {
            delete store[key]
            return Promise.resolve()
        }
    }
})

describe('secureStorage wrapper', () => {
    it('sets and gets wallet address', async () => {
        await secure.setWalletAddress('0xabc')
        const addr = await secure.getWalletAddress()
        expect(addr).toBe('0xabc')
    })

    it('deletes wallet address', async () => {
        await secure.setWalletAddress('0x123')
        await secure.deleteWalletAddress()
        const addr = await secure.getWalletAddress()
        expect(addr).toBeNull()
    })

    it('sets and gets connection state', async () => {
        const state = { connected: true, provider: 'metamask' }
        await secure.setConnectionState(state)
        const got = await secure.getConnectionState()
        expect(got).toEqual(state)
    })

    it('exposes generic get/set/delete', async () => {
        await secure.secureStorage.set(secure.StorageKey.AuthToken, { token: 't' })
        const t = await secure.secureStorage.get(secure.StorageKey.AuthToken)
        expect(t).toEqual({ token: 't' })
        await secure.secureStorage.delete(secure.StorageKey.AuthToken)
        const t2 = await secure.secureStorage.get(secure.StorageKey.AuthToken)
        expect(t2).toBeNull()
    })
})
