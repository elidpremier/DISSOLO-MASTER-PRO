/**
 * main.ts
 * Point d'entrée de DissoloMaster Pro — Machine d'états principale.
 *
 * Phases : SETUP → PREVIEW → RUNNING → RESULTS (→ SETUP)
 *
 * Chaque vue est montée dans .app-main et démontée lors de la transition.
 * L'AudioManager est partagé entre PreviewView et RunningView.
 */

import "./styles/main.css";

import type { TrialConfig } from "./types/timeline";
import type { TimelineAction } from "./types/timeline";
import type { ActionEvent } from "./timer/EventRecord";

import { generateTimeline } from "./engine/generateTimeline";
import { detectConflicts } from "./engine/detectConflicts";
import { AudioManager } from "./audio/AudioManager";
import { SetupView } from "./ui/SetupView";
import { PreviewView } from "./ui/PreviewView";
import { RunningView } from "./ui/RunningView";
import { ResultsView } from "./ui/ResultsView";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AppPhase = "setup" | "preview" | "running" | "results";

interface Unmountable {
  unmount(): void;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

class App {
  private readonly root: HTMLElement;
  private readonly mainEl: HTMLElement;
  private readonly headerTrialEl: HTMLElement;
  private readonly headerPhaseEl: HTMLElement;

  private readonly audio: AudioManager;
  private currentView: Unmountable | null = null;

  constructor() {
    const root = document.getElementById("app");
    if (!root) throw new Error("Élément #app introuvable dans le DOM.");
    this.root = root;

    // Structure principale
    this.root.innerHTML = this.renderAppShell();

    const mainEl = this.root.querySelector<HTMLElement>(".app-main");
    const headerTrialEl = this.root.querySelector<HTMLElement>(".app-header__trial-id");
    const headerPhaseEl = this.root.querySelector<HTMLElement>(".app-header__phase");

    if (!mainEl || !headerTrialEl || !headerPhaseEl) {
      throw new Error("Structure DOM de l'application incorrecte.");
    }

    this.mainEl = mainEl;
    this.headerTrialEl = headerTrialEl;
    this.headerPhaseEl = headerPhaseEl;
    this.audio = new AudioManager();

    this.showSetup();
  }

  // -------------------------------------------------------------------------
  // Shell HTML
  // -------------------------------------------------------------------------

  private renderAppShell(): string {
    return `
      <header class="app-header">
        <div class="app-header__logo">
          <span class="app-header__logo-icon">🧪</span>
          DissoloMaster Pro
        </div>
        <div class="app-header__trial">
          <span class="app-header__phase" id="header-phase">Configuration</span>
          <span class="app-header__trial-id" id="header-trial">—</span>
        </div>
      </header>
      <main class="app-main"></main>
    `;
  }

  // -------------------------------------------------------------------------
  // Transitions
  // -------------------------------------------------------------------------

  private clearView(): void {
    this.currentView?.unmount();
    this.currentView = null;
    this.mainEl.innerHTML = "";
  }

  private updateHeader(phase: AppPhase, trialId?: string): void {
    const labels: Record<AppPhase, string> = {
      setup: "Configuration",
      preview: "Aperçu",
      running: "Essai en cours",
      results: "Résultats",
    };
    this.headerPhaseEl.textContent = labels[phase];
    this.headerTrialEl.textContent = trialId ?? "—";
  }

  private showSetup(): void {
    this.clearView();
    this.updateHeader("setup");
    const view = new SetupView((config) => this.showPreview(config));
    view.mount(this.mainEl);
    this.currentView = view;
  }

  private showPreview(config: TrialConfig): void {
    this.clearView();
    this.updateHeader("preview", config.id);

    let actions: TimelineAction[];
    try {
      actions = generateTimeline(config);
    } catch {
      // Ne devrait pas se produire (déjà validé dans SetupView), mais sécurité
      this.showSetup();
      return;
    }

    const conflicts = detectConflicts(actions, config);

    const view = new PreviewView(
      config,
      actions,
      conflicts,
      this.audio,
      () => this.showRunning(config, actions),
      () => this.showSetup()
    );
    view.mount(this.mainEl);
    this.currentView = view;
  }

  private showRunning(config: TrialConfig, actions: TimelineAction[]): void {
    this.clearView();
    this.updateHeader("running", config.id);

    const view = new RunningView(
      config,
      actions,
      this.audio,
      (records) => this.showResults(config, records)
    );
    view.mount(this.mainEl);
    this.currentView = view;
  }

  private showResults(config: TrialConfig, records: ActionEvent[]): void {
    this.clearView();
    this.updateHeader("results", config.id);

    const view = new ResultsView(config, records, () => this.showSetup());
    view.mount(this.mainEl);
    this.currentView = view;
  }
}

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  new App();
});
