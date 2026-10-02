export const EMAILJS_SEND_URL = 'https://api.emailjs.com/api/v1.0/email/send';
const DELAI_MAX_MS = 10_000;

export interface EmailJsCredentials {
  serviceId: string;
  publicKey: string;
  privateKey: string;
}

// Échec d'envoi : `detail` (nom de l'erreur réseau ou statut HTTP) est sûr à
// journaliser — ni destinataire, ni contenu.
export class EmailJsSendError extends Error {
  constructor(readonly detail: string) {
    super(`EmailJS : ${detail}`);
    this.name = 'EmailJsSendError';
  }
}

// Appel de l'API REST d'EmailJS authentifié par la clé privée (ADR 0025) :
// l'option « Use Private Key » doit être active sur le compte.
export async function sendEmailJs(
  credentials: EmailJsCredentials,
  templateId: string,
  templateParams: Record<string, string | number>,
): Promise<void> {
  let status: number;
  try {
    const response = await fetch(EMAILJS_SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: credentials.serviceId,
        template_id: templateId,
        user_id: credentials.publicKey,
        accessToken: credentials.privateKey,
        template_params: templateParams,
      }),
      signal: AbortSignal.timeout(DELAI_MAX_MS),
    });
    status = response.status;
  } catch (error) {
    throw new EmailJsSendError((error as Error).name);
  }

  if (status < 200 || status >= 300) {
    throw new EmailJsSendError(`HTTP ${status}`);
  }
}
