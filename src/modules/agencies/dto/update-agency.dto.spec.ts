import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateAgencyDto } from './update-agency.dto';

async function erreurs(body: object): Promise<number> {
  return (await validate(plainToInstance(UpdateAgencyDto, body))).length;
}

describe('UpdateAgencyDto', () => {
  it('accepte une adresse seule ou des coordonnées bancaires complètes', async () => {
    expect(await erreurs({ address: 'Adresse factice' })).toBe(0);
    expect(
      await erreurs({
        bankDetails: {
          accountName: 'Agence Factice',
          accountNumber: 'FACTICE-0000',
          bankName: 'Banque Factice',
        },
      }),
    ).toBe(0);
  });

  it('refuse des coordonnées bancaires partielles ou vides', async () => {
    expect(
      await erreurs({ bankDetails: { accountName: 'Agence Factice' } }),
    ).toBeGreaterThan(0);
    expect(
      await erreurs({
        bankDetails: { accountName: '', accountNumber: '', bankName: '' },
      }),
    ).toBeGreaterThan(0);
  });
});
