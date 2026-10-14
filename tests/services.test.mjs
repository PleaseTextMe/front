import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test, beforeEach } from 'node:test';

const asModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const cryptoSource = (await readFile(new URL('../src/services/crypto.js', import.meta.url), 'utf8'))
  .replace("'libsodium-wrappers-sumo'", JSON.stringify(import.meta.resolve('libsodium-wrappers-sumo')));
const cryptoUrl = asModule(cryptoSource);
const { cryptoService } = await import(cryptoUrl);
const authSource = (await readFile(new URL('../src/services/auth.js', import.meta.url), 'utf8'))
  .replace("'./crypto'", JSON.stringify(cryptoUrl)).replaceAll('import.meta.env', '({})');
const authUrl = asModule(authSource);
const { authService } = await import(authUrl);
const messagesSource = (await readFile(new URL('../src/services/messageService.js', import.meta.url), 'utf8'))
  .replace("'./crypto'", JSON.stringify(cryptoUrl)).replace("'./auth'", JSON.stringify(authUrl))
  .replaceAll('import.meta.env', '({})');
const { messageService, getMessagesWebSocketUrl } = await import(asModule(messagesSource));

const storage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

beforeEach(() => {
  globalThis.localStorage = storage();
  globalThis.sessionStorage = storage();
  globalThis.window = { location: { href: 'https://chat.example.com/' } };
});

test('new vaults use unique salts and round-trip without sharing the login credential', async () => {
  const password = 'correct horse battery staple';
  const first = await cryptoService.generateRegistrationData(password, 'alice@example.com');
  const second = await cryptoService.generateRegistrationData(password, 'alice@example.com');
  assert.notEqual(first.vault.kdfSalt, second.vault.kdfSalt);
  assert.equal(first.authHash, second.authHash);
  assert.notEqual(first.authHash, password);
  assert.notEqual(first.authHash, await cryptoService.deriveAuthCredential(password, 'bob@example.com'));
  const vault = {
    encrypted_payload: first.vault.encryptedPayload, nonce: first.vault.nonce,
    auth_tag: first.vault.authTag, kdf_salt: first.vault.kdfSalt,
  };
  assert.deepEqual(await cryptoService.decryptVault(password, vault), first.keys);
  assert.equal(await cryptoService.decryptVault('wrong password', vault), null);
});

test('key bundle signatures are verified and large messages round-trip', async () => {
  const alice = await cryptoService.generateRegistrationData('alice-password', 'alice@example.com');
  const bob = await cryptoService.generateRegistrationData('bob-password', 'bob@example.com');
  const bundle = { bundle_json: bob.publicBundle.bundleJson, signature: bob.publicBundle.signature };
  const bobPublic = await cryptoService.verifyPublicBundle(bundle);
  const alicePublic = JSON.parse(alice.publicBundle.bundleJson);
  const text = 'large encrypted message '.repeat(10000);
  const encrypted = await cryptoService.encryptMessage(
    text, alice.keys.agreement_priv_x25519, bobPublic.agreement_pub_x25519,
  );
  assert.equal(await cryptoService.decryptMessage(
    encrypted.ciphertext, encrypted.nonce, bob.keys.agreement_priv_x25519,
    alicePublic.agreement_pub_x25519,
  ), text);
  const tampered = { ...bundle, bundle_json: bundle.bundle_json + ' ' };
  await assert.rejects(cryptoService.verifyPublicBundle(tampered));
});

test('missing or invalid recipient keys never send placeholder ciphertext', async () => {
  sessionStorage.setItem('chat_session_user', JSON.stringify({
    login: 'alice', token: 'token', keys: { agreement_priv_x25519: 'invalid-key' },
  }));
  let postRequests = 0;
  globalThis.fetch = async (_url, options) => {
    if (options?.method === 'POST') postRequests++;
    return { ok: true, json: async () => [] };
  };
  assert.equal(await messageService.sendMessage('bob', 'hello'), false);
  assert.equal(postRequests, 0);
});

test('corrupt stored sessions fail safely and legacy sessions migrate to tab storage', () => {
  localStorage.setItem('chat_session_user', '{broken');
  assert.equal(authService.checkSession(), null);
  assert.equal(localStorage.getItem('chat_session_user'), null);
  const session = { login: 'alice', token: 'token', keys: {} };
  localStorage.setItem('chat_session_user', JSON.stringify(session));
  assert.deepEqual(authService.checkSession(), session);
  assert.equal(localStorage.getItem('chat_session_user'), null);
  assert.equal(JSON.parse(sessionStorage.getItem('chat_session_user')).token, 'token');
});

test('logout clears local access before the network request completes', async () => {
  sessionStorage.setItem('chat_session_user', JSON.stringify({ login: 'alice', token: 'token', keys: {} }));
  let complete;
  globalThis.fetch = () => new Promise(resolve => { complete = resolve; });
  const logout = authService.logout();
  assert.equal(authService.checkSession(), null);
  complete({ ok: true });
  await logout;
});

test('WebSocket tokens are URL encoded', () => {
  const url = new URL(getMessagesWebSocketUrl('token&with=special?characters'));
  assert.equal(url.protocol, 'ws:');
  assert.equal(url.pathname, '/api/v1/messages/ws');
  assert.equal(url.searchParams.get('token'), 'token&with=special?characters');
});

test('registration and version 2 login never send the vault password', async () => {
  const password = 'my vault password';
  let payload;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/register/')) {
      payload = JSON.parse(options.body);
      return { ok: true, json: async () => ({ auth_token: 'registered-token' }) };
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  assert.equal(await authService.register('alice@example.com', 'alice', password, 'verify-token'), true);
  assert.notEqual(payload.password, password);
  assert.equal(payload.vault.auth_version, 2);
  assert.equal(localStorage.getItem('chat_session_user'), null);
  sessionStorage.removeItem('chat_session_user');
  let loginCredential;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/login-parameters/')) return { ok: true, json: async () => ({ auth_version: 2 }) };
    if (url.endsWith('/login/')) {
      loginCredential = JSON.parse(options.body).password;
      return { ok: true, json: async () => ({ auth_token: 'login-token' }) };
    }
    if (url.endsWith('/me/')) return {
      ok: true, json: async () => ({ email: payload.email, username: payload.username, vault: payload.vault }),
    };
    throw new Error(`Unexpected request: ${url}`);
  };
  assert.equal(await authService.login('alice@example.com', password), true);
  assert.equal(loginCredential, payload.password);
  assert.equal(authService.checkSession().token, 'login-token');
});

test('vaults without salt metadata still decrypt with the legacy salt', async () => {
  const sodium = await cryptoService.init();
  const password = 'legacy password';
  const derived = sodium.crypto_pwhash(
    64, new TextEncoder().encode(password), new Uint8Array(16),
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE, sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
  const key = await crypto.subtle.importKey('raw', derived.slice(32), 'AES-GCM', false, ['encrypt']);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const keys = { agreement_priv_x25519: 'legacy-secret' };
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, key, new TextEncoder().encode(JSON.stringify(keys)),
  ));
  assert.deepEqual(await cryptoService.decryptVault(password, {
    encrypted_payload: Buffer.from(encrypted.slice(0, -16)).toString('base64'),
    nonce: Buffer.from(nonce).toString('base64'),
    auth_tag: Buffer.from(encrypted.slice(-16)).toString('base64'),
  }), keys);
});
