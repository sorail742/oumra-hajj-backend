import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

// Destinataire du code OTP : téléphone (SMS) ou email (EmailJS, ADR 0025).
export type OtpContact = { phone: string } | { email: string };

interface ContactFields {
  phone?: string;
  email?: string;
}

// Exactement l'un des deux champs `phone` / `email`.
@ValidatorConstraint({ name: 'exactlyOneContact' })
export class ExactlyOneContact implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const { phone, email } = args.object as ContactFields;
    return (phone === undefined) !== (email === undefined);
  }

  defaultMessage(): string {
    return 'Renseignez soit phone, soit email (un seul des deux)';
  }
}

export function toOtpContact(dto: ContactFields): OtpContact {
  return dto.email === undefined
    ? { phone: dto.phone as string }
    : { email: dto.email.trim().toLowerCase() };
}
