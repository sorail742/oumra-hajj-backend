export const PUSH_SENDER = 'PUSH_SENDER';

// Abstraction du provider de notifications push — Firebase Cloud Messaging
// retenu par l'ADR 0009, intégration réelle à brancher ici une fois les
// identifiants FCM disponibles.
export interface PushSender {
  send(
    userId: string,
    title: string,
    content: string,
  ): Promise<{ delivered: boolean }>;
}
