let nip44Module: any = null;

async function getNip44() {
  if (!nip44Module) {
    try {
      nip44Module = require('nostr-tools/nip44');
    } catch {
      nip44Module = {
        encrypt: (content: string, params: any) => {
          throw new Error('nip44 not available - install nostr-tools');
        },
        decrypt: (content: string, params: any) => {
          throw new Error('nip44 not available - install nostr-tools');
        },
      };
    }
  }
  return nip44Module;
}

export async function encryptNip44(content: string, params: { privkey: string; pubkey: string }): Promise<string> {
  const nip44 = await getNip44();
  return nip44.encrypt(content, params);
}

export async function decryptNip44(content: string, params: { privkey: string; pubkey: string }): Promise<string> {
  const nip44 = await getNip44();
  return nip44.decrypt(content, params);
}
