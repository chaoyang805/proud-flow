import type { DispatchRequestedMessage, RealtimeEvent } from "@proud-flow/domain";

export class RealtimeHub {
  private dispatchClients: Array<(msg: DispatchRequestedMessage) => void> = [];
  private realtimeClients: Array<(event: RealtimeEvent) => void> = [];
  private realtimeEvents: RealtimeEvent[] = [];

  // --- Dispatch ---

  registerDispatchClient(send: (msg: DispatchRequestedMessage) => void): () => void {
    this.dispatchClients.push(send);
    console.log(`[realtime-hub] dispatch client registered (total: ${this.dispatchClients.length})`);
    return () => {
      this.dispatchClients = this.dispatchClients.filter((fn) => fn !== send);
      console.log(`[realtime-hub] dispatch client unregistered (remaining: ${this.dispatchClients.length})`);
    };
  }

  hasDispatchClient(): boolean {
    return this.dispatchClients.length > 0;
  }

  sendToDispatchClient(msg: DispatchRequestedMessage): boolean {
    if (this.dispatchClients.length === 0) return false;
    console.log(`[realtime-hub] pushing dispatch to ${this.dispatchClients.length} daemon(s): ${msg.requestId}`);
    for (const send of this.dispatchClients) {
      try { send(msg); } catch { /* disconnected */ }
    }
    return true;
  }

  // --- Realtime ---

  registerRealtimeClient(send: (event: RealtimeEvent) => void): () => void {
    this.realtimeClients.push(send);
    console.log(`[realtime-hub] realtime client registered (total: ${this.realtimeClients.length})`);
    return () => {
      this.realtimeClients = this.realtimeClients.filter((fn) => fn !== send);
      console.log(`[realtime-hub] realtime client unregistered (remaining: ${this.realtimeClients.length})`);
    };
  }

  listRealtimeEvents(): RealtimeEvent[] {
    return [...this.realtimeEvents];
  }

  broadcast(event: RealtimeEvent): void {
    this.realtimeEvents.push(event);
    console.log(`[realtime-hub] broadcasting event: type=${event.type} eventId=${event.eventId}`);
    for (const send of this.realtimeClients) {
      try { send(event); } catch { /* disconnected */ }
    }
  }
}
