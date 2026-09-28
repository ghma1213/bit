import { randomInt } from 'node:crypto';

// 혼동되기 쉬운 문자(0/O, 1/l/I) 제외
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** 암호학적 난수로 임시 비밀번호를 생성한다 (16자 ≈ 93bit). */
export function generateTempPassword(length = 16): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
