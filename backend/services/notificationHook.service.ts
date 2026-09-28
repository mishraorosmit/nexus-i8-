export type NotificationEventType =
  | 'recruitment.submitted'
  | 'recruitment.status_changed'
  | 'contact.submitted'
  | 'event.registered'
  | 'event.cancelled';

export interface NotificationPayloads {
  'recruitment.submitted': {
    id: string;
    reference_id?: string;
    name: string;
    maskedEmail: string;
    domain: string;
    timestamp: string;
  };
  'recruitment.status_changed': {
    id: string;
    oldStatus: string;
    newStatus: string;
    timestamp: string;
  };
  'contact.submitted': {
    id: string;
    reference_id?: string;
    category: string;
    name: string;
    maskedEmail: string;
    timestamp: string;
  };
  'event.registered': {
    registrationId: string;
    reference_id?: string;
    eventId: string;
    attendeeName: string;
    maskedEmail: string;
    timestamp: string;
  };
  'event.cancelled': {
    registrationId: string;
    eventId: string;
    timestamp: string;
  };
}

export type NotificationHandler<T extends NotificationEventType> = (
  payload: NotificationPayloads[T]
) => Promise<void> | void;

export class NotificationHookService {
  private handlers = new Map<NotificationEventType, Set<NotificationHandler<any>>>();

  constructor() {
    // Default audit logger handler that respects privacy guardrails
    this.on('recruitment.submitted', (payload) => {
      console.log(`[NotificationHook] Event recruitment.submitted: id=${payload.id}, domain=${payload.domain}`);
    });
    this.on('recruitment.status_changed', (payload) => {
      console.log(`[NotificationHook] Event recruitment.status_changed: id=${payload.id}, status=${payload.oldStatus}->${payload.newStatus}`);
    });
    this.on('contact.submitted', (payload) => {
      console.log(`[NotificationHook] Event contact.submitted: id=${payload.id}, category=${payload.category}`);
    });
    this.on('event.registered', (payload) => {
      console.log(`[NotificationHook] Event event.registered: regId=${payload.registrationId}, eventId=${payload.eventId}`);
    });
  }

  public on<T extends NotificationEventType>(event: T, handler: NotificationHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    // Return unregister function
    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  /**
   * Dispatch notification event asynchronously (fire-and-forget).
   * Request handlers are never blocked or failed by notification listeners.
   */
  public dispatch<T extends NotificationEventType>(event: T, payload: NotificationPayloads[T]): void {
    const listeners = this.handlers.get(event);
    if (!listeners || listeners.size === 0) return;

    // Run asynchronously outside the main request cycle
    setImmediate(async () => {
      for (const handler of Array.from(listeners)) {
        try {
          await handler(payload);
        } catch (err) {
          console.error(`[NotificationHook] Error in listener for ${event}:`, err);
        }
      }
    });
  }

  /**
   * Mask an email address to protect privacy in logs and notification event payloads
   * e.g., 'student@university.edu' -> 's***t@university.edu'
   */
  public static maskEmail(email: string): string {
    const parts = email.split('@');
    if (parts.length !== 2) return '***@***';
    const [user, domain] = parts;
    if (user.length <= 2) {
      return `${user[0]}***@${domain}`;
    }
    return `${user[0]}***${user[user.length - 1]}@${domain}`;
  }

  public clearAllListeners(): void {
    this.handlers.clear();
  }
}

export const notificationHooks = new NotificationHookService();
