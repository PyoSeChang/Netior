import { SLASH_COMMANDS } from '@netior/shared/constants';
import type { SlashCommand } from '@netior/shared/types';

export interface ParsedCommand {
  command: SlashCommand;
  args: Record<string, string>;
}

/**
 * Parse a message starting with "/" into a command + args.
 * Returns null if the message is not a command or doesn't match any known command.
 */
export function parseCommand(message: string): ParsedCommand | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith('/')) return null;

  const parts = trimmed.slice(1).split(/\s+/);
  const commandName = parts[0]?.toLowerCase();
  if (!commandName) return null;

  const command = SLASH_COMMANDS.find((c) => c.name === commandName);
  if (!command) return null;

  // Map remaining words as positional args to command.args
  const args: Record<string, string> = {};
  const argValues = parts.slice(1);
  const commandArgs = command.args ?? [];
  for (let i = 0; i < commandArgs.length && i < argValues.length; i++) {
    args[commandArgs[i].name] = argValues[i];
  }

  return { command, args };
}

export function isConversationCommand(parsed: ParsedCommand): boolean {
  return parsed.command.type === 'conversation';
}

export function isSystemCommand(parsed: ParsedCommand): boolean {
  return parsed.command.type === 'system';
}
