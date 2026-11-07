import type { Illustration } from '../../../packages/engine/src';

/** What a lab's compute() returns: a list of blocks the shared renderer knows how to draw. */
export type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'note'; text: string; tone?: 'info' | 'good' | 'warn' | 'bad' }
  | { kind: 'table'; caption?: string; head: string[]; rows: string[][]; foot?: string[]; numeric?: number[] }
  | { kind: 'journal'; entries: readonly Illustration[] }
  | { kind: 'steps'; title: string; steps: string[] }
  /** Horizontal bars. `value` is for geometry only — the exact figure is the `text`. */
  | { kind: 'bars'; title: string; items: { label: string; value: number; text: string; tone?: 'a' | 'b' | 'c' | 'neg' }[] }
  /** One stacked bar per row (e.g. old vs new profit-sharing ratio). Segment `value`s are fractions of 1. */
  | { kind: 'ratio'; title: string; rows: { label: string; segments: { name: string; value: number; text: string }[] }[] }
  /** The accounting equation / balance sheet as two balanced columns. */
  | { kind: 'equation'; assets: { label: string; value: number; text: string }[]; rhs: { label: string; value: number; text: string }[]; balanced: boolean }
  /** Three cash-flow streams. */
  | { kind: 'streams'; items: { label: string; value: number; text: string }[]; net: string }
  /** A left-to-right lifecycle with a status per stage. */
  | { kind: 'lifecycle'; stages: { name: string; detail: string; state: 'done' | 'skip' | 'issue' }[] };

export type FieldType = 'money' | 'int' | 'percent' | 'ratio' | 'text' | 'select' | 'textarea';
export interface Field {
  readonly id: string; readonly label: string; readonly type: FieldType;
  readonly help?: string; readonly options?: readonly { value: string; label: string }[]; readonly group?: string;
}

export class InputError extends Error {
  constructor(message: string, readonly field?: string) { super(message); this.name = 'InputError'; }
}

export interface Lab {
  readonly id: string;
  readonly cls: 'XI' | 'XII';
  readonly title: string;
  readonly clauses: readonly string[];
  readonly summary: string;
  readonly concept: readonly string[];
  readonly realWorld: string;
  readonly fields: readonly Field[];
  /** The worked example: these values are used for the "Worked example" tab and are the starting point for "Try it". */
  readonly example: Readonly<Record<string, string>>;
  /** Plain-language walk-through of the worked example (why each step). */
  readonly walkthrough: readonly string[];
  readonly compute: (values: Record<string, string>) => Block[];
  /** Practice skills (see packages/curriculum questions) that exercise this lab. */
  readonly skills: readonly string[];
  /** Optional route restriction for Class XII. */
  readonly route?: 'OPTION_I_ANALYSIS';
}
