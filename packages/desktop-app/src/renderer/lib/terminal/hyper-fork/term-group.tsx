import React from 'react';
import type { TerminalEngineLaunchConfig } from '../engine/terminal-engine';
import type { TerminalAppearanceSnapshot } from './terminal-appearance';
import { ForkedHyperTerm, type ForkedHyperTermHandle } from './term';

export interface ForkedHyperTermGroupHandle {
  getTerm(): ForkedHyperTermHandle | null;
}

interface ForkedHyperTermGroupProps {
  uid: string;
  appearance: TerminalAppearanceSnapshot;
  launchConfig?: TerminalEngineLaunchConfig;
  isTermActive: boolean;
  isTermVisible: boolean;
  onData(data: string): void;
  onResize(cols: number, rows: number): void;
  onTitle?(title: string): void;
  onActive(): void;
}

export class ForkedHyperTermGroup extends React.PureComponent<ForkedHyperTermGroupProps> implements ForkedHyperTermGroupHandle {
  private termRef: ForkedHyperTermHandle | null = null;

  getTerm(): ForkedHyperTermHandle | null {
    return this.termRef;
  }

  render(): JSX.Element {
    return (
      <ForkedHyperTerm
        ref={this.onTermRef}
        uid={this.props.uid}
        appearance={this.props.appearance}
        launchConfig={this.props.launchConfig}
        isTermActive={this.props.isTermActive}
        isTermVisible={this.props.isTermVisible}
        onData={this.props.onData}
        onResize={this.props.onResize}
        onTitle={this.props.onTitle}
        onActive={this.props.onActive}
      />
    );
  }

  private readonly onTermRef = (term: ForkedHyperTerm | null): void => {
    this.termRef = term;
  };
}
