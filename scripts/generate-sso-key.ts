import { exportJWK, generateKeyPair } from "jose";

async function main() {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA", {
    crv: "Ed25519",
    extractable: true,
  });
  const publicJwk = await exportJWK(publicKey);
  const privateJwk = await exportJWK(privateKey);
  console.log(`SSO_PRIVATE_JWK=${JSON.stringify(privateJwk)}`);
  console.log(`SSO_PUBLIC_JWK=${JSON.stringify(publicJwk)}`);
}

main();
