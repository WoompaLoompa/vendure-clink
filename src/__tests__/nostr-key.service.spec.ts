jest.mock('nostr-tools', () => ({
  generateSecretKey: jest.fn().mockReturnValue(new Uint8Array(32)),
  getPublicKey: jest.fn().mockReturnValue('a'.repeat(64)),
}));

import { NostrKeyService } from '../services/nostr-key.service';
import { ClinkChannelConfig } from '../entities/clink-channel-config.entity';

describe('NostrKeyService', () => {
  let service: NostrKeyService;
  let mockConnection: any;

  beforeEach(() => {
    mockConnection = {
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn(),
        save: jest.fn(),
      }),
    };
    service = new NostrKeyService(mockConnection);
  });

  describe('generateKeyPair', () => {
    it('should generate a valid Nostr keypair', () => {
      const keys = service.generateKeyPair();

      expect(keys.secretKey).toBeInstanceOf(Uint8Array);
      expect(keys.secretKey.length).toBe(32);
      expect(keys.pubkey).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('getPubkeyFromSecretKey', () => {
    it('should derive correct pubkey from secret key', () => {
      const keys = service.generateKeyPair();
      const secretKeyHex = Buffer.from(keys.secretKey).toString('hex');
      const derivedPubkey = service.getPubkeyFromSecretKey(secretKeyHex);

      expect(derivedPubkey).toBe(keys.pubkey);
    });
  });

  describe('secretKeyToPubkey', () => {
    it('should return same pubkey as getPubkeyFromSecretKey', () => {
      const keys = service.generateKeyPair();
      const secretKeyHex = Buffer.from(keys.secretKey).toString('hex');

      expect(service.secretKeyToPubkey(secretKeyHex)).toBe(
        service.getPubkeyFromSecretKey(secretKeyHex),
      );
    });
  });

  describe('getOrCreateChannelKeys', () => {
    it('should return existing config if found', async () => {
      const mockConfig = {
        id: 1,
        channel: { id: 1 },
        nostrPubkey: 'existing-pubkey',
        relayUrls: ['wss://relay.example.com'],
      } as ClinkChannelConfig;

      mockConnection.getRepository().findOne.mockResolvedValue(mockConfig);

      const ctx = { channelId: 1 } as any;
      const result = await service.getOrCreateChannelKeys(ctx, 1);

      expect(result).toBe(mockConfig);
      expect(mockConnection.getRepository().save).not.toHaveBeenCalled();
    });

    it('should create new config with generated keys if none exists', async () => {
      mockConnection.getRepository().findOne.mockResolvedValue(null);
      mockConnection.getRepository().save.mockImplementation(
        (config: any) => Promise.resolve({ ...config, id: 1 }),
      );

      const ctx = { channelId: 1 } as any;
      const result = await service.getOrCreateChannelKeys(ctx, 1);

      expect(mockConnection.getRepository().save).toHaveBeenCalledTimes(1);
      expect(result.nostrPubkey).toMatch(/^[0-9a-f]{64}$/);
      expect(result.relayUrls).toEqual(['wss://relay.shocknetwork.com']);
      expect(result.autoSettle).toBe(true);
      expect(result.offerExpiryMinutes).toBe(30);
    });
  });

  describe('updateConfig', () => {
    it('should merge updates with existing config', async () => {
      const existingConfig = {
        id: 1,
        channel: { id: 1 },
        nostrPubkey: 'test-pubkey',
        relayUrls: ['wss://relay.example.com'],
        autoSettle: true,
        offerExpiryMinutes: 30,
        httpFallback: true,
      } as ClinkChannelConfig;

      mockConnection.getRepository().findOne.mockResolvedValue(existingConfig);
      mockConnection.getRepository().save.mockImplementation(
        (config: any) => Promise.resolve(config),
      );

      const ctx = { channelId: 1 } as any;
      const result = await service.updateConfig(ctx, 1, {
        relayUrls: ['wss://new-relay.com'],
        offerExpiryMinutes: 60,
      });

      expect(result.relayUrls).toEqual(['wss://new-relay.com']);
      expect(result.offerExpiryMinutes).toBe(60);
    });
  });
});
