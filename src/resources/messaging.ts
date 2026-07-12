import { serializeEntity } from '../core/xml'
import type { Transport } from '../core/transport'

export interface MessageSend {
  /** alternativeIdentifier do remetente. */
  sender?: string
  /** alternativeIdentifiers dos destinatários (usuários mobile). */
  recipients: string[]
  /** Corpo da mensagem — máx. 500 caracteres (limite da API). */
  description: string
  /** Envia push imediato; sem isso a entrega ocorre no próximo sync do device. */
  sendNotification?: boolean
  hideAnswer?: boolean
}

export interface MessagesResource {
  send(msg: MessageSend): Promise<void>
}

export interface PushNotificationSend {
  message: string
  /** alternativeIdentifiers dos agentes destinatários. */
  agents: string[]
}

export interface PushNotificationsResource {
  /** Notificação unidirecional, efêmera no device (apagada após visualização); entrega pode atrasar. */
  send(notification: PushNotificationSend): Promise<void>
}

export type SmsTarget = { agentId: number } | { agentAltId: string } | { serviceLocalAltId: string }

export interface SmsSend {
  to: SmsTarget
  message: string
  /** Inclui link de download do app no SMS. */
  sendDownloadLink: boolean
}

export interface SmsResource {
  /**
   * Requer conta Zenvia configurada via Help Desk da uMov.me.
   * Por altId, o SMS só é enviado se exatamente um agente corresponder.
   */
  send(sms: SmsSend): Promise<void>
}

export function createMessagingResources(transport: Transport): {
  messages: MessagesResource
  pushNotifications: PushNotificationsResource
  sms: SmsResource
} {
  return {
    messages: {
      async send(msg) {
        if (msg.description.length > 500) {
          throw new RangeError(`Mensagem excede 500 caracteres (${msg.description.length}) — limite da uMov.me`)
        }
        const xml = serializeEntity('message', {
          sender: msg.sender ? { alternativeIdentifier: msg.sender } : undefined,
          recipients: { recipient: msg.recipients.map((r) => ({ alternativeIdentifier: r })) },
          description: msg.description,
          sendNotification: msg.sendNotification,
          hideAnswer: msg.hideAnswer,
        })
        await transport.post('message.xml', xml)
      },
    },
    pushNotifications: {
      async send(notification) {
        const xml = serializeEntity('scheduleNotification', {
          message: notification.message,
          agents: { agent: notification.agents.map((a) => ({ alternativeIdentifier: a })) },
        })
        await transport.post('scheduleNotification.xml', xml)
      },
    },
    sms: {
      async send(sms) {
        const target =
          'agentId' in sms.to
            ? { agent: { id: sms.to.agentId } }
            : 'agentAltId' in sms.to
              ? { agent: { alternativeIdentifier: sms.to.agentAltId } }
              : { serviceLocal: { alternativeIdentifier: sms.to.serviceLocalAltId } }
        const xml = serializeEntity('smsRequest', {
          ...target,
          message: sms.message,
          sendDownloadLink: sms.sendDownloadLink,
        })
        await transport.post('smsRequest.xml', xml)
      },
    },
  }
}
