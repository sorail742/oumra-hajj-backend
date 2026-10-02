import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { toOtpContact } from './otp-contact';
import { RequestOtpDto } from './request-otp.dto';

async function erreurs(body: object): Promise<number> {
  return (await validate(plainToInstance(RequestOtpDto, body))).length;
}

describe('RequestOtpDto (ADR 0025)', () => {
  it('accepte un téléphone seul ou un email seul', async () => {
    expect(await erreurs({ phone: '+224620000000' })).toBe(0);
    expect(await erreurs({ email: 'pelerin@example.test' })).toBe(0);
  });

  it('refuse les deux à la fois, aucun des deux, ou un email invalide', async () => {
    expect(
      await erreurs({ phone: '+224620000000', email: 'pelerin@example.test' }),
    ).toBeGreaterThan(0);
    expect(await erreurs({})).toBeGreaterThan(0);
    expect(await erreurs({ email: 'pas-un-email' })).toBeGreaterThan(0);
  });

  it("normalise l'adresse en minuscules", () => {
    expect(toOtpContact({ email: ' Pelerin@Example.TEST ' })).toEqual({
      email: 'pelerin@example.test',
    });
  });
});
