const SecureStore = require('expo-secure-store')

const StorageKey = {
    WalletAddress: 'wallet_address',
    ConnectionState: 'connection_state',
    AuthToken: 'auth_token'
}

async function setItem(key, value) {
    const payload = JSON.stringify(value)
    return SecureStore.setItemAsync(key, payload, { keychainAccessible: SecureStore.ALWAYS_THIS_DEVICE_ONLY })
}

async function getItem(key) {
    const item = await SecureStore.getItemAsync(key)
    if (!item) return null
    try {
        return JSON.parse(item)
    } catch (e) {
        return null
    }
}

async function deleteItem(key) {
    return SecureStore.deleteItemAsync(key)
}

async function setWalletAddress(address) {
    return setItem(StorageKey.WalletAddress, address)
}

async function getWalletAddress() {
    return getItem(StorageKey.WalletAddress)
}

async function deleteWalletAddress() {
    return deleteItem(StorageKey.WalletAddress)
}

async function setConnectionState(state) {
    return setItem(StorageKey.ConnectionState, state)
}

async function getConnectionState() {
    return getItem(StorageKey.ConnectionState)
}

async function deleteConnectionState() {
    return deleteItem(StorageKey.ConnectionState)
}

const secureStorage = {
    get: getItem,
    set: setItem,
    delete: deleteItem
}

module.exports = {
    StorageKey,
    setItem,
    getItem,
    deleteItem,
    setWalletAddress,
    getWalletAddress,
    deleteWalletAddress,
    setConnectionState,
    getConnectionState,
    deleteConnectionState,
    secureStorage
}
