export class PendingUiResponses {
  private readonly pending = new Map<string, {
    resolve: (result: string) => void;
  }>();

  waitForResponse(callId: string): Promise<string> {
    return new Promise((resolve) => {
      this.pending.set(callId, { resolve });
    });
  }

  resolve(callId: string, response: unknown): boolean {
    const pending = this.pending.get(callId);
    if (!pending) return false;

    pending.resolve(JSON.stringify(response));
    this.pending.delete(callId);
    return true;
  }
}
