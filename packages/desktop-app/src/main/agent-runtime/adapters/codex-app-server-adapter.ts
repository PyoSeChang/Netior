import { spawn, type ChildProcess } from 'child_process';
import { createHash, randomBytes } from 'crypto';
import { app } from 'electron';
import { chmodSync, existsSync, mkdirSync, watch, writeFileSync, type FSWatcher } from 'fs';
import { createConnection, createServer, type Socket } from 'net';
import { basename, delimiter, join } from 'path';
import type { AgentAttentionReason, AgentStatus, TerminalLaunchConfig } from '@netior/shared/types';
import type {
  AgentRuntimeAdapter,
  AgentRuntimeSink,
  TerminalCleanupReason,
} from '../agent-runtime-manager';

type JsonRpcId = number | string;

interface JsonRpcResponseMessage {
  id: JsonRpcId;
  result?: unknown;
  error?: {
    code?: number;
    message?: string;
  };
}

interface JsonRpcNotificationMessage {
  method?: string;
  params?: unknown;
}

interface WebSocketMessageEventLike {
  data: unknown;
}

interface WebSocketCloseEventLike {
  code?: number;
  reason?: string;
}

interface WebSocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: 'open', listener: () => void, options?: { once?: boolean }): void;
  addEventListener(type: 'message', listener: (event: WebSocketMessageEventLike) => void, options?: { once?: boolean }): void;
  addEventListener(type: 'error', listener: () => void, options?: { once?: boolean }): void;
  addEventListener(type: 'close', listener: (event: WebSocketCloseEventLike) => void, options?: { once?: boolean }): void;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutHandle: NodeJS.Timeout;
}

interface CodexAppServerSession {
  terminalSessionId: string;
  remoteUrl: string;
  wrapperDir: string;
  wrapperLogPath: string;
  cwd: string;
  child: ChildProcess | null;
  socket: WebSocketLike | null;
  activationWatcher: FSWatcher | null;
  activationInFlight: Promise<void> | null;
  pendingRequests: Map<JsonRpcId, PendingRequest>;
  externalSessionId: string | null;
  started: boolean;
  lastStatus: AgentStatus | null;
  lastStatusReason: AgentAttentionReason | null;
  spawnError: Error | null;
}

interface CodexLaunchCommand {
  command: string;
  args: string[];
}

type ListenerRecord<T> = {
  listener: T;
  once: boolean;
};

class LoopbackWebSocketClient implements WebSocketLike {
  private readonly listeners = {
    open: [] as Array<ListenerRecord<() => void>>,
    message: [] as Array<ListenerRecord<(event: WebSocketMessageEventLike) => void>>,
    error: [] as Array<ListenerRecord<() => void>>,
    close: [] as Array<ListenerRecord<(event: WebSocketCloseEventLike) => void>>,
  };

  private readonly socket: Socket;
  private readonly websocketUrl: URL;
  private readonly expectedAccept: string;
  private handshakeBuffer = Buffer.alloc(0);
  private frameBuffer = Buffer.alloc(0);
  private handshakeComplete = false;
  private closeEmitted = false;
  private closeFrameSent = false;
  private fragmentedTextChunks: Buffer[] | null = null;
  private remoteCloseCode: number | undefined;
  private remoteCloseReason: string | undefined;

  constructor(url: string) {
    this.websocketUrl = new URL(url);
    if (this.websocketUrl.protocol !== 'ws:') {
      throw new Error(`Unsupported websocket protocol: ${this.websocketUrl.protocol}`);
    }

    const key = randomBytes(16).toString('base64');
    this.expectedAccept = createHash('sha1')
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');

    this.socket = createConnection({
      host: this.websocketUrl.hostname,
      port: Number(this.websocketUrl.port || 80),
    });
    this.socket.setNoDelay(true);

    this.socket.on('connect', () => {
      const requestPath = `${this.websocketUrl.pathname || '/'}${this.websocketUrl.search}`;
      const request = [
        `GET ${requestPath} HTTP/1.1`,
        `Host: ${this.websocketUrl.host}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13',
        '\r\n',
      ].join('\r\n');
      this.socket.write(request);
    });

    this.socket.on('data', (chunk: Buffer) => {
      try {
        this.handleSocketData(chunk);
      } catch {
        this.emit('error');
        this.socket.destroy();
      }
    });

    this.socket.on('error', () => {
      this.emit('error');
    });

    this.socket.on('close', () => {
      this.emitClose({
        code: this.remoteCloseCode,
        reason: this.remoteCloseReason,
      });
    });
  }

  send(data: string): void {
    if (!this.handshakeComplete || this.socket.destroyed) {
      throw new Error('WebSocket is not open');
    }
    this.writeFrame(0x1, Buffer.from(data, 'utf-8'));
  }

  close(code?: number, reason?: string): void {
    if (this.socket.destroyed) {
      this.emitClose({ code, reason });
      return;
    }

    if (!this.closeFrameSent) {
      const reasonBuffer = reason ? Buffer.from(reason, 'utf-8') : Buffer.alloc(0);
      const payload = code != null
        ? Buffer.concat([Buffer.from([(code >> 8) & 0xff, code & 0xff]), reasonBuffer])
        : Buffer.alloc(0);
      this.writeFrame(0x8, payload);
      this.closeFrameSent = true;
    }

    this.socket.end();
  }

  addEventListener(
    type: 'open' | 'message' | 'error' | 'close',
    listener: (() => void) | ((event: WebSocketMessageEventLike | WebSocketCloseEventLike) => void),
    options?: { once?: boolean },
  ): void {
    const record = { listener: listener as never, once: !!options?.once };
    switch (type) {
      case 'open':
        this.listeners.open.push(record as ListenerRecord<() => void>);
        break;
      case 'message':
        this.listeners.message.push(record as ListenerRecord<(event: WebSocketMessageEventLike) => void>);
        break;
      case 'error':
        this.listeners.error.push(record as ListenerRecord<() => void>);
        break;
      case 'close':
        this.listeners.close.push(record as ListenerRecord<(event: WebSocketCloseEventLike) => void>);
        break;
    }
  }

  private handleSocketData(chunk: Buffer): void {
    if (!this.handshakeComplete) {
      this.handshakeBuffer = Buffer.concat([this.handshakeBuffer, chunk]);
      const headerEnd = this.handshakeBuffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) {
        return;
      }

      const headerText = this.handshakeBuffer.slice(0, headerEnd).toString('utf-8');
      const leftover = this.handshakeBuffer.slice(headerEnd + 4);
      this.handshakeBuffer = Buffer.alloc(0);
      this.completeHandshake(headerText);
      if (leftover.length > 0) {
        this.handleFrames(leftover);
      }
      return;
    }

    this.handleFrames(chunk);
  }

  private completeHandshake(headerText: string): void {
    const lines = headerText.split('\r\n');
    const statusLine = lines.shift() ?? '';
    if (!statusLine.startsWith('HTTP/1.1 101')) {
      throw new Error(`WebSocket upgrade failed: ${statusLine || 'missing status line'}`);
    }

    const headers = new Map<string, string>();
    for (const line of lines) {
      const separator = line.indexOf(':');
      if (separator === -1) {
        continue;
      }
      const key = line.slice(0, separator).trim().toLowerCase();
      const value = line.slice(separator + 1).trim();
      headers.set(key, value);
    }

    if (headers.get('sec-websocket-accept') !== this.expectedAccept) {
      throw new Error('WebSocket upgrade failed: invalid Sec-WebSocket-Accept');
    }

    this.handshakeComplete = true;
    this.emit('open');
  }

  private handleFrames(chunk: Buffer): void {
    this.frameBuffer = Buffer.concat([this.frameBuffer, chunk]);

    while (this.frameBuffer.length >= 2) {
      const firstByte = this.frameBuffer[0];
      const secondByte = this.frameBuffer[1];
      const fin = (firstByte & 0x80) !== 0;
      const opcode = firstByte & 0x0f;
      const masked = (secondByte & 0x80) !== 0;
      let payloadLength = secondByte & 0x7f;
      let offset = 2;

      if (payloadLength === 126) {
        if (this.frameBuffer.length < offset + 2) {
          return;
        }
        payloadLength = this.frameBuffer.readUInt16BE(offset);
        offset += 2;
      } else if (payloadLength === 127) {
        if (this.frameBuffer.length < offset + 8) {
          return;
        }
        const declaredLength = Number(this.frameBuffer.readBigUInt64BE(offset));
        if (!Number.isSafeInteger(declaredLength)) {
          throw new Error('WebSocket frame is too large');
        }
        payloadLength = declaredLength;
        offset += 8;
      }

      const maskLength = masked ? 4 : 0;
      const frameLength = offset + maskLength + payloadLength;
      if (this.frameBuffer.length < frameLength) {
        return;
      }

      const mask = masked ? this.frameBuffer.slice(offset, offset + 4) : null;
      const payloadOffset = offset + maskLength;
      const payload = Buffer.from(this.frameBuffer.slice(payloadOffset, payloadOffset + payloadLength));
      this.frameBuffer = this.frameBuffer.slice(frameLength);

      if (mask) {
        for (let index = 0; index < payload.length; index++) {
          payload[index] ^= mask[index % 4];
        }
      }

      this.handleFrame(opcode, fin, payload);
    }
  }

  private handleFrame(opcode: number, fin: boolean, payload: Buffer): void {
    switch (opcode) {
      case 0x0:
        if (!this.fragmentedTextChunks) {
          throw new Error('Received unexpected websocket continuation frame');
        }
        this.fragmentedTextChunks.push(payload);
        if (fin) {
          const text = Buffer.concat(this.fragmentedTextChunks).toString('utf-8');
          this.fragmentedTextChunks = null;
          this.emit('message', { data: text });
        }
        break;
      case 0x1:
        if (fin) {
          this.emit('message', { data: payload.toString('utf-8') });
        } else {
          this.fragmentedTextChunks = [payload];
        }
        break;
      case 0x8: {
        if (payload.length >= 2) {
          this.remoteCloseCode = payload.readUInt16BE(0);
          this.remoteCloseReason = payload.slice(2).toString('utf-8');
        }
        if (!this.closeFrameSent) {
          this.writeFrame(0x8, payload);
          this.closeFrameSent = true;
        }
        this.socket.end();
        break;
      }
      case 0x9:
        this.writeFrame(0xA, payload);
        break;
      case 0xA:
        break;
      default:
        break;
    }
  }

  private writeFrame(opcode: number, payload: Buffer): void {
    if (this.socket.destroyed) {
      return;
    }

    const mask = randomBytes(4);
    const maskedPayload = Buffer.from(payload);
    for (let index = 0; index < maskedPayload.length; index++) {
      maskedPayload[index] ^= mask[index % 4];
    }

    let header: Buffer;
    if (maskedPayload.length < 126) {
      header = Buffer.alloc(2);
      header[1] = 0x80 | maskedPayload.length;
    } else if (maskedPayload.length < 65_536) {
      header = Buffer.alloc(4);
      header[1] = 0x80 | 126;
      header.writeUInt16BE(maskedPayload.length, 2);
    } else {
      header = Buffer.alloc(10);
      header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(maskedPayload.length), 2);
    }

    header[0] = 0x80 | opcode;
    this.socket.write(Buffer.concat([header, mask, maskedPayload]));
  }

  private emit(type: 'open'): void;
  private emit(type: 'error'): void;
  private emit(type: 'message', payload: WebSocketMessageEventLike): void;
  private emit(type: 'close', payload: WebSocketCloseEventLike): void;
  private emit(type: 'open' | 'message' | 'error' | 'close', payload?: WebSocketMessageEventLike | WebSocketCloseEventLike): void {
    const records = this.listeners[type];
    for (const record of [...records]) {
      if (type === 'open' || type === 'error') {
        (record.listener as () => void)();
      } else {
        (record.listener as (event: WebSocketMessageEventLike | WebSocketCloseEventLike) => void)(payload!);
      }
      if (record.once) {
        const index = records.indexOf(record as never);
        if (index >= 0) {
          records.splice(index, 1);
        }
      }
    }
  }

  private emitClose(event: WebSocketCloseEventLike): void {
    if (this.closeEmitted) {
      return;
    }
    this.closeEmitted = true;
    this.emit('close', event);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function allocateLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address !== 'object') {
        server.close();
        reject(new Error('Failed to allocate a loopback port for Codex app-server'));
        return;
      }

      const { port } = address;
      server.close(() => {
        resolve(port);
      });
    });
  });
}

function normalizeMessageData(data: unknown): string | null {
  if (typeof data === 'string') {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString('utf-8');
  }
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf-8');
  }
  return null;
}

function buildCodexLaunchCommand(args: string[]): CodexLaunchCommand {
  if (process.platform === 'win32') {
    return {
      command: process.env.COMSPEC || 'C:\\WINDOWS\\System32\\cmd.exe',
      args: ['/d', '/s', '/c', 'codex', ...args],
    };
  }

  return {
    command: 'codex',
    args,
  };
}

const CODEX_WRAPPER_REMOTE_ENV_KEY = 'NETIOR_CODEX_REMOTE_URL';
const CODEX_WRAPPER_DIR_ENV_KEY = 'NETIOR_CODEX_WRAPPER_DIR';
const CODEX_WRAPPER_LOG_PATH_ENV_KEY = 'NETIOR_CODEX_WRAPPER_LOG_PATH';
const CODEX_WRAPPER_ACTIVATION_FILE = 'activation.request';

interface AgentStatusUpdate {
  status: AgentStatus;
  reason: AgentAttentionReason | null;
}

function buildInjectedPath(wrapperDir: string, existingPath?: string): string {
  const entries = (existingPath ?? process.env.PATH ?? '')
    .split(delimiter)
    .filter((entry) => entry.length > 0 && entry.toLowerCase() !== wrapperDir.toLowerCase());

  return [wrapperDir, ...entries].join(delimiter);
}

function isPowerShellExecutable(shell?: string): boolean {
  if (!shell) {
    return process.platform === 'win32';
  }

  const normalized = basename(shell).toLowerCase();
  return normalized === 'powershell.exe' || normalized === 'pwsh.exe';
}

function buildPowerShellBootstrapArgs(wrapperDir: string): string[] {
  const bootstrapPath = join(wrapperDir, 'codex-bootstrap.ps1').replace(/'/g, "''");
  return ['-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', `. '${bootstrapPath}'`];
}

function getActivationRequestPath(wrapperDir: string): string {
  return join(wrapperDir, CODEX_WRAPPER_ACTIVATION_FILE);
}

function buildCodexWrapperPowerShellScript(): string {
  return `
$ErrorActionPreference = 'Stop'
$logPath = $env:${CODEX_WRAPPER_LOG_PATH_ENV_KEY}

function Write-DebugLog([string]$message) {
  if ([string]::IsNullOrWhiteSpace($logPath)) {
    return
  }

  try {
    Add-Content -LiteralPath $logPath -Value ("[{0}] {1}" -f (Get-Date -Format o), $message)
  } catch {
    # ignore wrapper logging failures
  }
}

function ShouldInjectRemote([string[]]$argv) {
  $passthroughCommands = @('exec', 'review', 'login', 'logout', 'mcp', 'mcp-server', 'app-server', 'completion', 'sandbox', 'debug', 'apply', 'cloud', 'features', 'help')
  $skipNext = $false
  $firstPositional = $null

  function ConsumesValue([string]$arg) {
    return (
      $arg -eq '--config' -or
      $arg -ceq '-c' -or
      $arg -eq '--remote' -or
      $arg -eq '--remote-auth-token-env' -or
      $arg -eq '--image' -or
      $arg -ceq '-i' -or
      $arg -eq '--model' -or
      $arg -ceq '-m' -or
      $arg -eq '--profile' -or
      $arg -ceq '-p' -or
      $arg -eq '--sandbox' -or
      $arg -ceq '-s' -or
      $arg -eq '--ask-for-approval' -or
      $arg -ceq '-a' -or
      $arg -eq '--cd' -or
      $arg -ceq '-C' -or
      $arg -eq '--add-dir' -or
      $arg -eq '--local-provider' -or
      $arg -eq '--enable' -or
      $arg -eq '--disable'
    )
  }

  foreach ($arg in $argv) {
    if ($skipNext) {
      $skipNext = $false
      continue
    }

    if ($arg -eq '--remote') {
      return $false
    }

    if ($arg -in @('-h', '--help', '-V', '--version')) {
      return $false
    }

    if (ConsumesValue $arg) {
      $skipNext = $true
      continue
    }

    if ($arg.StartsWith('-')) {
      continue
    }

    $firstPositional = $arg
    break
  }

  if ([string]::IsNullOrWhiteSpace($firstPositional)) {
    return $true
  }

  return -not ($passthroughCommands -contains $firstPositional)
}

$remoteUrl = $env:${CODEX_WRAPPER_REMOTE_ENV_KEY}
$wrapperDir = $env:${CODEX_WRAPPER_DIR_ENV_KEY}
Write-DebugLog ("invoke cwd={0} args={1}" -f $pwd.Path, ($args -join ' '))

function Signal-AppServerActivation([string]$wrapperDir, [string]$remoteUrl) {
  if ([string]::IsNullOrWhiteSpace($wrapperDir)) {
    return
  }

  $activationPath = Join-Path $wrapperDir '${CODEX_WRAPPER_ACTIVATION_FILE}'
  Set-Content -LiteralPath $activationPath -Value ("[{0}] remote={1} pid={2}" -f (Get-Date -Format o), $remoteUrl, $PID) -Force
}

function Wait-ForAppServerReady([string]$remoteUrl) {
  $uri = [Uri]$remoteUrl
  $readyUrl = "http://$($uri.Host):$($uri.Port)/readyz"

  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $readyUrl -Method Get -TimeoutSec 1
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        Write-DebugLog ("ready after attempt={0}" -f $attempt)
        return
      }
    } catch {
      # app-server not ready yet
    }

    Start-Sleep -Milliseconds 100
  }

  throw "Timed out waiting for Codex app-server at $readyUrl"
}

if ([string]::IsNullOrWhiteSpace($remoteUrl)) {
  Write-DebugLog 'missing remote url'
  throw 'Netior Codex wrapper is missing NETIOR_CODEX_REMOTE_URL.'
}

if (-not [string]::IsNullOrWhiteSpace($wrapperDir)) {
  $targetWrapperDir = [System.IO.Path]::GetFullPath($wrapperDir)
  $filteredPath = New-Object System.Collections.Generic.List[string]
  foreach ($entry in ($env:PATH -split [System.IO.Path]::PathSeparator)) {
    if ([string]::IsNullOrWhiteSpace($entry)) {
      continue
    }

    $candidate = [System.IO.Path]::GetFullPath($entry)
    if ($candidate.Equals($targetWrapperDir, [System.StringComparison]::OrdinalIgnoreCase)) {
      continue
    }

    $null = $filteredPath.Add($entry)
  }

  $env:PATH = [string]::Join([System.IO.Path]::PathSeparator, $filteredPath)
}

$forwardArgs = New-Object System.Collections.Generic.List[string]
$injectRemote = ShouldInjectRemote $args
Write-DebugLog ("injectRemote={0}" -f $injectRemote)
if ($injectRemote) {
  Signal-AppServerActivation $wrapperDir $remoteUrl
  Wait-ForAppServerReady $remoteUrl
  $null = $forwardArgs.Add('--remote')
  $null = $forwardArgs.Add($remoteUrl)
}

foreach ($arg in $args) {
  $null = $forwardArgs.Add([string]$arg)
}

Write-DebugLog ("forwardArgs={0}" -f ($forwardArgs -join ' '))

try {
  & codex @forwardArgs
  $exitCode = $LASTEXITCODE
  Write-DebugLog ("exitCode={0}" -f $exitCode)
  exit $exitCode
} catch {
  Write-DebugLog ("execFailed={0}" -f $_.Exception.Message)
  throw
}
`.trimStart();
}

function buildCodexPowerShellBootstrapScript(): string {
  return `
$ErrorActionPreference = 'Stop'
$wrapperPath = Join-Path $PSScriptRoot 'codex-wrapper.ps1'
$powershellPath = Join-Path $PSHOME 'powershell.exe'

function codex {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$RemainingArgs
  )

  & $powershellPath -NoLogo -NoProfile -ExecutionPolicy Bypass -File $wrapperPath @RemainingArgs
  if ($null -ne $LASTEXITCODE) {
    $global:LASTEXITCODE = $LASTEXITCODE
  }
}
`.trimStart();
}

function buildCodexWrapperShellScript(): string {
  return `#!/usr/bin/env bash
set -euo pipefail

log_path="\${${CODEX_WRAPPER_LOG_PATH_ENV_KEY}:-}"

write_debug_log() {
  [[ -z "$log_path" ]] && return 0
  printf '[%s] %s\n' "$(date -Iseconds)" "$*" >> "$log_path" 2>/dev/null || true
}

should_inject_remote() {
  local skip_next=0
  local passthrough_commands=(exec review login logout mcp mcp-server app-server completion sandbox debug apply cloud features help)

  for arg in "$@"; do
    if [[ "$skip_next" -eq 1 ]]; then
      skip_next=0
      continue
    fi

    case "$arg" in
      --remote|-h|--help|-V|--version)
        return 1
        ;;
      --config|-c|--remote-auth-token-env|--image|-i|--model|-m|--profile|-p|--sandbox|-s|--ask-for-approval|-a|--cd|-C|--add-dir|--local-provider|--enable|--disable)
        skip_next=1
        continue
        ;;
      -*)
        continue
        ;;
      *)
        for command in "\${passthrough_commands[@]}"; do
          if [[ "$arg" == "$command" ]]; then
            return 1
          fi
        done
        return 0
        ;;
    esac
  done

  return 0
}

remote_url="\${${CODEX_WRAPPER_REMOTE_ENV_KEY}:-}"
wrapper_dir="\${${CODEX_WRAPPER_DIR_ENV_KEY}:-}"
write_debug_log "invoke cwd=$(pwd) args=$*"

signal_activation() {
  [[ -z "$wrapper_dir" ]] && return 0
  printf '[%s] remote=%s pid=%s\n' "$(date -Iseconds)" "$remote_url" "$$" > "$wrapper_dir/${CODEX_WRAPPER_ACTIVATION_FILE}"
}

wait_for_remote_ready() {
  local stripped="\${remote_url#ws://}"
  local hostport="\${stripped%%/*}"
  local host="\${hostport%%:*}"
  local port="\${hostport##*:}"

  for ((attempt = 0; attempt < 60; attempt++)); do
    if (echo >"/dev/tcp/$host/$port") >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.1
  done

  echo "Timed out waiting for Codex app-server at $remote_url" >&2
  exit 1
}

if [[ -z "$remote_url" ]]; then
  write_debug_log "missing remote url"
  echo "Netior Codex wrapper is missing ${CODEX_WRAPPER_REMOTE_ENV_KEY}." >&2
  exit 1
fi

if [[ -n "$wrapper_dir" ]]; then
  IFS=':' read -r -a path_entries <<< "$PATH"
  filtered_path=()
  for entry in "\${path_entries[@]}"; do
    [[ -z "$entry" || "$entry" == "$wrapper_dir" ]] && continue
    filtered_path+=("$entry")
  done
  PATH="$(IFS=:; echo "\${filtered_path[*]}")"
  export PATH
fi

if should_inject_remote "$@"; then
  signal_activation
  wait_for_remote_ready
  write_debug_log "injectRemote=true"
  write_debug_log "forwardArgs=--remote $remote_url $*"
  exec codex --remote "$remote_url" "$@"
fi

write_debug_log "injectRemote=false"
write_debug_log "forwardArgs=$*"
exec codex "$@"
`;
}

function ensureCodexWrapperDirectory(terminalSessionId: string): { wrapperDir: string; wrapperLogPath: string } {
  const wrapperDir = join(app.getPath('userData'), 'agent-runtime', 'codex-wrapper', terminalSessionId);
  mkdirSync(wrapperDir, { recursive: true });
  const wrapperLogPath = join(wrapperDir, 'wrapper.log');
  const shellWrapperPath = join(wrapperDir, 'codex');
  writeFileSync(shellWrapperPath, buildCodexWrapperShellScript(), 'utf-8');
  chmodSync(shellWrapperPath, 0o755);

  if (process.platform === 'win32') {
    writeFileSync(join(wrapperDir, 'codex-wrapper.ps1'), buildCodexWrapperPowerShellScript(), 'utf-8');
    writeFileSync(join(wrapperDir, 'codex-bootstrap.ps1'), buildCodexPowerShellBootstrapScript(), 'utf-8');
    writeFileSync(
      join(wrapperDir, 'codex.ps1'),
      '& "$PSScriptRoot\\codex-wrapper.ps1" @args\r\nexit $LASTEXITCODE\r\n',
      'utf-8',
    );
    writeFileSync(
      join(wrapperDir, 'codex.cmd'),
      '@echo off\r\npowershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0codex-wrapper.ps1" %*\r\n',
      'utf-8',
    );
    return { wrapperDir, wrapperLogPath };
  }

  return { wrapperDir, wrapperLogPath };
}

function formatRpcError(error: unknown): string {
  if (typeof error === 'object' && error != null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown Codex app-server error';
}

function toAgentStatusUpdate(status: unknown): AgentStatusUpdate {
  if (!status || typeof status !== 'object' || !('type' in status)) {
    return { status: 'offline', reason: null };
  }

  const type = status.type;
  if (type === 'idle') {
    return { status: 'idle', reason: null };
  }
  if (type === 'systemError') {
    return { status: 'error', reason: null };
  }
  if (type === 'notLoaded') {
    return { status: 'offline', reason: null };
  }
  if (type === 'active') {
    const activeStatus = status as { activeFlags?: unknown };
    const activeFlags = Array.isArray(activeStatus.activeFlags)
      ? activeStatus.activeFlags
      : [];
    if (activeFlags.includes('waitingOnApproval')) {
      return { status: 'blocked', reason: 'approval' };
    }
    if (activeFlags.includes('waitingOnUserInput')) {
      return { status: 'blocked', reason: 'user_input' };
    }
    return { status: 'working', reason: null };
  }

  return { status: 'offline', reason: null };
}

async function connectWebSocket(url: string, timeoutMs: number): Promise<WebSocketLike> {
  return new Promise((resolve, reject) => {
    const socket = new LoopbackWebSocketClient(url);
    let settled = false;

    const resolveOnce = (value: WebSocketLike): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const rejectOnce = (error: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(error);
    };

    const timer = setTimeout(() => {
      try {
        socket.close();
      } catch {
        // ignore close failures during timeout handling
      }
      rejectOnce(new Error(`Timed out connecting to Codex app-server at ${url}`));
    }, timeoutMs);

    socket.addEventListener('open', () => {
      resolveOnce(socket);
    }, { once: true });

    socket.addEventListener('error', () => {
      try {
        socket.close();
      } catch {
        // ignore close failures during error handling
      }
      rejectOnce(new Error(`Failed to connect to Codex app-server at ${url}`));
    }, { once: true });

    socket.addEventListener('close', (event) => {
      const closeEvent = event as WebSocketCloseEventLike;
      rejectOnce(new Error(`Codex app-server socket closed during connect (${closeEvent.code ?? 'unknown'} ${closeEvent.reason ?? ''})`.trim()));
    }, { once: true });
  });
}

export class CodexAppServerAdapter implements AgentRuntimeAdapter {
  readonly provider = 'codex' as const;

  private sink: AgentRuntimeSink | null = null;
  private readonly sessions = new Map<string, CodexAppServerSession>();
  private nextRequestId = 1;

  async start(sink: AgentRuntimeSink): Promise<void> {
    this.sink = sink;
  }

  stop(): void {
    for (const sessionId of Array.from(this.sessions.keys())) {
      this.cleanupSession(sessionId, 'shutdown', null);
    }
    this.sink = null;
  }

  async prepareTerminalLaunch(
    terminalSessionId: string,
    launchConfig: TerminalLaunchConfig,
  ): Promise<{ launchConfig: TerminalLaunchConfig; active: boolean }> {
    if (launchConfig.agent?.provider && launchConfig.agent.provider !== 'codex') {
      return { launchConfig, active: false };
    }

    if (!this.sink) {
      throw new Error('Codex app-server adapter started without a runtime sink');
    }

    const port = await allocateLoopbackPort();
    const remoteUrl = `ws://127.0.0.1:${port}`;
    const { wrapperDir, wrapperLogPath } = ensureCodexWrapperDirectory(terminalSessionId);

    const session: CodexAppServerSession = {
      terminalSessionId,
      remoteUrl,
      wrapperDir,
      wrapperLogPath,
      cwd: launchConfig.cwd,
      child: null,
      socket: null,
      activationWatcher: null,
      activationInFlight: null,
      pendingRequests: new Map(),
      externalSessionId: null,
      started: false,
      lastStatus: null,
      lastStatusReason: null,
      spawnError: null,
    };

    this.sessions.set(terminalSessionId, session);
    session.activationWatcher = watch(wrapperDir, { persistent: false }, (_eventType, filename) => {
      const changed = typeof filename === 'string' ? filename : null;
      if (changed === CODEX_WRAPPER_ACTIVATION_FILE) {
        void this.ensureSessionActivated(session);
      }
    });

    if (existsSync(getActivationRequestPath(wrapperDir))) {
      void this.ensureSessionActivated(session);
    }

    const resolvedLaunchConfig: TerminalLaunchConfig = {
      ...launchConfig,
      env: {
        ...launchConfig.env,
        [CODEX_WRAPPER_REMOTE_ENV_KEY]: remoteUrl,
        [CODEX_WRAPPER_DIR_ENV_KEY]: wrapperDir,
        [CODEX_WRAPPER_LOG_PATH_ENV_KEY]: wrapperLogPath,
        PATH: buildInjectedPath(wrapperDir, launchConfig.env?.PATH),
      },
    };

    if (process.platform === 'win32' && isPowerShellExecutable(launchConfig.shell)) {
      resolvedLaunchConfig.shell = launchConfig.shell ?? 'C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
      resolvedLaunchConfig.args = buildPowerShellBootstrapArgs(wrapperDir);
    }

    if (launchConfig.agent?.provider === 'codex') {
      resolvedLaunchConfig.shell = 'codex';
      resolvedLaunchConfig.title = launchConfig.title ?? 'Codex';
      resolvedLaunchConfig.agent = {
        provider: 'codex',
        remoteUrl,
      };
    }

    return {
      launchConfig: resolvedLaunchConfig,
      active: true,
    };
  }

  cleanupTerminalLaunch(
    terminalSessionId: string,
    reason: TerminalCleanupReason,
    exitCode: number | null,
  ): void {
    this.cleanupSession(terminalSessionId, reason, exitCode);
  }

  private ensureSessionActivated(session: CodexAppServerSession): Promise<void> {
    if (!this.sessions.has(session.terminalSessionId)) {
      return Promise.resolve();
    }

    if (session.socket || session.activationInFlight) {
      return session.activationInFlight ?? Promise.resolve();
    }

    session.activationInFlight = this.activateSession(session)
      .catch((error) => {
        console.warn(`[CodexAppServer:${session.terminalSessionId}] activation failed: ${formatRpcError(error)}`);
      })
      .finally(() => {
        session.activationInFlight = null;
      });

    return session.activationInFlight;
  }

  private async activateSession(session: CodexAppServerSession): Promise<void> {
    const child = this.spawnAppServer(session);
    session.child = child;

    const socket = await this.connectWithRetry(session, 5_000);
    session.socket = socket;
    socket.addEventListener('message', (event) => {
      this.handleSocketMessage(session, event.data);
    });
    socket.addEventListener('close', () => {
      session.socket = null;
      if (this.sessions.has(session.terminalSessionId)) {
        this.emitStatus(session, 'offline');
      }
    });
    socket.addEventListener('error', () => {
      if (this.sessions.has(session.terminalSessionId)) {
        this.emitStatus(session, 'offline');
      }
    });

    await this.sendRequest(session, 'initialize', {
      clientInfo: {
        name: 'netior',
        title: 'Netior',
        version: app.getVersion(),
      },
      capabilities: {
        experimentalApi: false,
      },
    }, 3_000);

    socket.send(JSON.stringify({
      method: 'initialized',
    }));
  }

  private spawnAppServer(session: CodexAppServerSession): ChildProcess {
    if (session.child && session.child.exitCode == null && !session.child.killed) {
      return session.child;
    }

    const appServerLaunch = buildCodexLaunchCommand(['app-server', '--listen', session.remoteUrl]);
    const child = spawn(appServerLaunch.command, appServerLaunch.args, {
      cwd: session.cwd,
      env: {
        ...process.env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    session.spawnError = null;
    child.stdout?.on('data', () => {});
    child.stderr?.on('data', () => {});
    child.on('error', (error) => {
      session.spawnError = error;
      console.error(`[CodexAppServer:${session.terminalSessionId}] spawn error: ${error.message}`);
    });
    child.on('exit', () => {
      session.child = null;
      if (!this.sessions.has(session.terminalSessionId)) {
        return;
      }

      this.emitStatus(session, 'offline');
    });

    return child;
  }

  private async connectWithRetry(
    session: CodexAppServerSession,
    timeoutMs: number,
  ): Promise<WebSocketLike> {
    const deadline = Date.now() + timeoutMs;
    let lastError: Error | null = null;

    while (Date.now() < deadline) {
      if (session.spawnError) {
        throw session.spawnError;
      }
      if (!session.child) {
        throw new Error('Codex app-server failed to start');
      }
      if (session.child.exitCode != null) {
        throw new Error(`Codex app-server exited before handshake (code ${session.child.exitCode})`);
      }

      try {
        return await connectWebSocket(session.remoteUrl, 1_000);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(formatRpcError(error));
        await delay(100);
      }
    }

    throw lastError ?? new Error(`Timed out waiting for Codex app-server at ${session.remoteUrl}`);
  }

  private async sendRequest(
    session: CodexAppServerSession,
    method: string,
    params: unknown,
    timeoutMs = 5_000,
  ): Promise<unknown> {
    if (!session.socket) {
      throw new Error('Codex app-server socket is not connected');
    }

    const id = this.nextRequestId++;

    const pending = new Promise<unknown>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        session.pendingRequests.delete(id);
        reject(new Error(`Codex app-server request timed out: ${method}`));
      }, timeoutMs);

      session.pendingRequests.set(id, {
        resolve,
        reject,
        timeoutHandle,
      });
    });

    session.socket.send(JSON.stringify({
      id,
      method,
      params,
    }));

    return pending;
  }

  private handleSocketMessage(session: CodexAppServerSession, rawData: unknown): void {
    const payload = normalizeMessageData(rawData);
    if (!payload) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch (error) {
      console.warn(`[CodexAppServer:${session.terminalSessionId}] invalid JSON message: ${formatRpcError(error)}`);
      return;
    }

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        this.handleJsonRpcMessage(session, item);
      }
      return;
    }

    this.handleJsonRpcMessage(session, parsed);
  }

  private handleJsonRpcMessage(session: CodexAppServerSession, message: unknown): void {
    if (!message || typeof message !== 'object') {
      return;
    }

    if ('id' in message && ('result' in message || 'error' in message)) {
      this.handleResponse(session, message as JsonRpcResponseMessage);
      return;
    }

    if ('method' in message) {
      const notification = message as JsonRpcNotificationMessage;
      if (typeof notification.method === 'string') {
        this.handleNotification(session, notification.method, notification.params);
      }
    }
  }

  private handleResponse(session: CodexAppServerSession, response: JsonRpcResponseMessage): void {
    const pending = session.pendingRequests.get(response.id);
    if (!pending) {
      return;
    }

    session.pendingRequests.delete(response.id);
    clearTimeout(pending.timeoutHandle);

    if (response.error) {
      pending.reject(new Error(response.error.message ?? 'Codex app-server returned an error'));
      return;
    }

    pending.resolve(response.result);
  }

  private handleNotification(
    session: CodexAppServerSession,
    method: string,
    params: unknown,
  ): void {
    switch (method) {
      case 'thread/started':
        this.handleThreadStarted(session, params);
        break;
      case 'thread/name/updated':
        this.handleThreadNameUpdated(session, params);
        break;
      case 'thread/status/changed':
        this.handleThreadStatusChanged(session, params);
        break;
      case 'thread/closed':
        this.handleThreadClosed(session, params);
        break;
      case 'turn/started':
        this.handleTurnStarted(session, params);
        break;
      case 'turn/completed':
        this.handleTurnCompleted(session, params);
        break;
      case 'error':
        this.emitStatus(session, 'error');
        break;
      default:
        break;
    }
  }

  private handleThreadStarted(session: CodexAppServerSession, params: unknown): void {
    const thread = this.readThread(params);
    if (!thread?.id) {
      return;
    }

    this.ensureSessionStarted(session, thread.id);
    if (typeof thread.name === 'string' && thread.name.length > 0) {
      this.sink?.emitNameEvent({
        provider: 'codex',
        sessionId: session.terminalSessionId,
        name: thread.name,
      });
    }
    if (thread.status) {
      const nextStatus = toAgentStatusUpdate(thread.status);
      this.emitStatus(session, nextStatus.status, nextStatus.reason);
    }
  }

  private handleThreadNameUpdated(session: CodexAppServerSession, params: unknown): void {
    if (!params || typeof params !== 'object') {
      return;
    }

    const payload = params as { threadId?: unknown; threadName?: unknown };
    const threadId = typeof payload.threadId === 'string' ? payload.threadId : null;
    const threadName = typeof payload.threadName === 'string' ? payload.threadName : null;
    if (!threadId || !threadName) {
      return;
    }

    this.ensureSessionStarted(session, threadId);
    this.sink?.emitNameEvent({
      provider: 'codex',
      sessionId: session.terminalSessionId,
      name: threadName,
    });
  }

  private handleThreadStatusChanged(session: CodexAppServerSession, params: unknown): void {
    if (!params || typeof params !== 'object') {
      return;
    }

    const payload = params as { threadId?: unknown; status?: unknown };
    const threadId = typeof payload.threadId === 'string' ? payload.threadId : null;
    if (!threadId) {
      return;
    }

    this.ensureSessionStarted(session, threadId);
    const nextStatus = toAgentStatusUpdate(payload.status);
    this.emitStatus(session, nextStatus.status, nextStatus.reason);
  }

  private handleTurnStarted(session: CodexAppServerSession, params: unknown): void {
    if (!params || typeof params !== 'object') {
      return;
    }

    const payload = params as { threadId?: unknown };
    const threadId = typeof payload.threadId === 'string' ? payload.threadId : null;
    const turnId = this.readTurnId(params);
    if (!threadId) {
      return;
    }

    this.ensureSessionStarted(session, threadId);
    if (session.lastStatus !== 'blocked') {
      this.emitStatus(session, 'working');
    }
    this.sink?.emitTurnEvent({
      provider: 'codex',
      sessionId: session.terminalSessionId,
      turnId,
      type: 'start',
    });
  }

  private handleThreadClosed(session: CodexAppServerSession, params: unknown): void {
    if (!params || typeof params !== 'object') {
      return;
    }

    const payload = params as { threadId?: unknown };
    const threadId = typeof payload.threadId === 'string' ? payload.threadId : null;
    if (!threadId || session.externalSessionId !== threadId || !session.started) {
      return;
    }

    this.sink?.emitSessionEvent({
      provider: 'codex',
      sessionId: session.terminalSessionId,
      surface: { kind: 'terminal', id: session.terminalSessionId },
      externalSessionId: threadId,
      type: 'stop',
    });
    session.externalSessionId = null;
    session.started = false;
    session.lastStatus = null;
    session.lastStatusReason = null;
  }

  private handleTurnCompleted(session: CodexAppServerSession, params: unknown): void {
    if (!params || typeof params !== 'object') {
      return;
    }

    const payload = params as { threadId?: unknown };
    const threadId = typeof payload.threadId === 'string' ? payload.threadId : null;
    const turn = this.readTurn(params);
    if (!threadId) {
      return;
    }

    this.ensureSessionStarted(session, threadId);
    this.sink?.emitTurnEvent({
      provider: 'codex',
      sessionId: session.terminalSessionId,
      turnId: turn?.id ?? null,
      type: 'complete',
    });

    if (turn?.status === 'failed') {
      this.emitStatus(session, 'error');
      return;
    }

    this.emitStatus(session, 'idle');
  }

  private ensureSessionStarted(session: CodexAppServerSession, externalSessionId: string): void {
    if (session.externalSessionId && session.externalSessionId !== externalSessionId && session.started) {
      this.sink?.emitSessionEvent({
        provider: 'codex',
        sessionId: session.terminalSessionId,
        surface: { kind: 'terminal', id: session.terminalSessionId },
        externalSessionId: session.externalSessionId,
        type: 'stop',
      });
      session.started = false;
      session.lastStatus = null;
      session.lastStatusReason = null;
    }

    session.externalSessionId = externalSessionId;

    if (session.started) {
      return;
    }

    session.started = true;
    this.sink?.emitSessionEvent({
      provider: 'codex',
      sessionId: session.terminalSessionId,
      surface: { kind: 'terminal', id: session.terminalSessionId },
      externalSessionId,
      type: 'start',
    });
  }

  private emitStatus(
    session: CodexAppServerSession,
    status: AgentStatus,
    reason: AgentAttentionReason | null = null,
  ): void {
    if (session.lastStatus === status && session.lastStatusReason === reason) {
      return;
    }

    session.lastStatus = status;
    session.lastStatusReason = reason;
    this.sink?.emitStatusEvent({
      provider: 'codex',
      sessionId: session.terminalSessionId,
      status,
      reason,
    });
  }

  private cleanupSession(
    terminalSessionId: string,
    reason: TerminalCleanupReason,
    exitCode: number | null,
  ): void {
    const session = this.sessions.get(terminalSessionId);
    if (!session) {
      return;
    }

    this.sessions.delete(terminalSessionId);

    for (const pending of session.pendingRequests.values()) {
      clearTimeout(pending.timeoutHandle);
      pending.reject(new Error(`Codex app-server session closed during ${reason}`));
    }
    session.pendingRequests.clear();

    try {
      session.activationWatcher?.close();
    } catch {
      // ignore watcher close failures during cleanup
    }
    session.activationWatcher = null;
    session.activationInFlight = null;

    if (session.started) {
      this.sink?.emitSessionEvent({
        provider: 'codex',
        sessionId: terminalSessionId,
        surface: { kind: 'terminal', id: terminalSessionId },
        externalSessionId: session.externalSessionId,
        type: 'stop',
      });
    }

    session.externalSessionId = null;
    session.started = false;
    session.lastStatus = null;
    session.lastStatusReason = null;

    try {
      session.socket?.close();
    } catch {
      // ignore websocket close failures during cleanup
    }
    session.socket = null;

    if (session.child && session.child.exitCode == null && !session.child.killed) {
      session.child.kill();
    }
    session.child = null;
  }

  private readThread(params: unknown): { id: string; name?: string | null; status?: unknown } | null {
    if (!params || typeof params !== 'object' || !('thread' in params)) {
      return null;
    }

    const thread = (params as { thread?: unknown }).thread;
    if (!thread || typeof thread !== 'object') {
      return null;
    }

    const payload = thread as { id?: unknown; name?: unknown; status?: unknown };
    if (typeof payload.id !== 'string') {
      return null;
    }

    return {
      id: payload.id,
      name: typeof payload.name === 'string' ? payload.name : null,
      status: payload.status,
    };
  }

  private readTurn(params: unknown): { id: string; status?: string | null } | null {
    if (!params || typeof params !== 'object' || !('turn' in params)) {
      return null;
    }

    const turn = (params as { turn?: unknown }).turn;
    if (!turn || typeof turn !== 'object') {
      return null;
    }

    const payload = turn as { id?: unknown; status?: unknown };
    if (typeof payload.id !== 'string') {
      return null;
    }

    return {
      id: payload.id,
      status: typeof payload.status === 'string' ? payload.status : null,
    };
  }

  private readTurnId(params: unknown): string | null {
    return this.readTurn(params)?.id ?? null;
  }
}
