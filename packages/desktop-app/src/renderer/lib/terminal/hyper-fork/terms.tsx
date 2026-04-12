import React from 'react';
import type { TerminalEngineLaunchConfig, TerminalRawXterm, TerminalSearchController } from '../engine/terminal-engine';
import type { TerminalAppearanceSnapshot } from './terminal-appearance';
import { ForkedHyperStyleSheet } from './style-sheet';
import { ForkedHyperTermGroup, type ForkedHyperTermGroupHandle } from './term-group';

export interface ForkedHyperTermsHandle {
  focusActiveTerm(): void;
  fitActiveTerm(): void;
  write(data: string | Uint8Array): void;
  scrollUpPage(): void;
  scrollDownPage(): void;
  hasSelection(): boolean;
  copySelection(): void;
  paste(text: string): void;
  getSelection(): string;
  getSearchController(): TerminalSearchController | undefined;
  getRawXterm(): TerminalRawXterm | undefined;
}

interface ForkedHyperTermsProps {
  uid: string;
  appearance: TerminalAppearanceSnapshot;
  launchConfig?: TerminalEngineLaunchConfig;
  visible: boolean;
  onData(data: string): void;
  onResize(cols: number, rows: number): void;
  onTitle?(title: string): void;
  onActive(): void;
}

export class ForkedHyperTerms extends React.PureComponent<ForkedHyperTermsProps> implements ForkedHyperTermsHandle {
  private termGroupRef: ForkedHyperTermGroupHandle | null = null;

  focusActiveTerm(): void {
    this.termGroupRef?.getTerm()?.focus();
  }

  fitActiveTerm(): void {
    this.termGroupRef?.getTerm()?.fitResize();
  }

  write(data: string | Uint8Array): void {
    this.termGroupRef?.getTerm()?.write(data);
  }

  scrollUpPage(): void {
    this.termGroupRef?.getTerm()?.scrollUpPage();
  }

  scrollDownPage(): void {
    this.termGroupRef?.getTerm()?.scrollDownPage();
  }

  hasSelection(): boolean {
    return this.termGroupRef?.getTerm()?.hasSelection() ?? false;
  }

  copySelection(): void {
    this.termGroupRef?.getTerm()?.copySelection();
  }

  paste(text: string): void {
    this.termGroupRef?.getTerm()?.paste(text);
  }

  getSelection(): string {
    return this.termGroupRef?.getTerm()?.getSelection() ?? '';
  }

  getSearchController(): TerminalSearchController | undefined {
    return this.termGroupRef?.getTerm()?.getSearchController();
  }

  getRawXterm(): TerminalRawXterm | undefined {
    return this.termGroupRef?.getTerm()?.getRawXterm();
  }

  render(): JSX.Element {
    const activeClassName = this.props.visible ? 'terms_termGroup terms_termGroupActive' : 'terms_termGroup';

    return (
      <div
        className="netior-hyper-terms"
        style={{
          position: 'absolute',
          inset: 0,
          color: '#fff',
        }}
      >
        <div
          className={activeClassName}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: this.props.visible ? 0 : '-9999em',
          }}
        >
          <ForkedHyperTermGroup
            ref={this.onTermGroupRef}
            uid={this.props.uid}
            appearance={this.props.appearance}
            launchConfig={this.props.launchConfig}
            isTermActive={this.props.visible}
            isTermVisible={this.props.visible}
            onData={this.props.onData}
            onResize={this.props.onResize}
            onTitle={this.props.onTitle}
            onActive={this.props.onActive}
          />
        </div>
        <ForkedHyperStyleSheet borderColor={this.props.appearance.colors.border} />
      </div>
    );
  }

  private readonly onTermGroupRef = (group: ForkedHyperTermGroup | null): void => {
    this.termGroupRef = group;
  };
}
