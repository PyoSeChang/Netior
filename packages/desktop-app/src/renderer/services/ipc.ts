import type { IpcResult } from '@netior/shared/types';

export function unwrapIpc<T>(result: IpcResult<T>): T {
  if (!result.success) throw new Error(result.error);
  return result.data;
}
