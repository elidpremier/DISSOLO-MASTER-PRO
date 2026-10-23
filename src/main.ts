/**
 * main.ts
 * Point d'entrée de DissoloMaster Pro — Machine d'états principale (M3).
 *
 * Phases : SETUP → PREVIEW → RUNNING → RESULTS (→ SETUP)
 *                                              (→ HISTORY)
 *          HISTORY → (SETUP | RESULTS lecture seule)
 *
 * Nouveautés M3 :
 * - Sauvegarde automatique IndexedDB à la fin de chaque essai.
 * - Bouton "Historique" dans le header disponible depuis toutes les phases.
 * - HistoryView : liste, export, suppression, import JSON.
 * - PWA : indicateur hors ligne + prompt d'installation.
 */

import "./styles/main.css";

import type { TrialConfig } from "./types/timeline";
import type { TimelineAction } from "./types/timeline";
import type { ActionEvent } from "./timer/EventRecord";
import type { StoredTrial } from "./db/TrialStore";

import { generateTimeline } from "./engine/generateTimeline";
import { detectConflicts } from "./engine/detectConflicts";
import { AudioManager } from "./audio/AudioManager";
import { SetupView } from "./ui/SetupView";
import { PreviewView } from "./ui/PreviewView";
import { RunningView } from "./ui/RunningView";
import { ResultsView } from "./ui/ResultsView";
import { HistoryView } from "./ui/HistoryView";
import { saveTrial, TrialStoreError } from "./db/TrialStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AppPhase = "setup" | "preview" | "running" | "results" | "history";

interface Unmountable {
  unmount(): void;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

class App {
  private readonly mainEl: HTMLElement;
  private readonly headerTrialEl: HTMLElement;
  private readonly headerPhaseEl: HTMLElement;
  private readonly historyBtnEl: HTMLButtonElement;
  private readonly saveIndicatorEl: HTMLElement;

  private readonly audio: AudioManager;
  private currentView: Unmountable | null = null;


  /** T0 de l'essai en cours (ISO 8601) — nécessaire pour la sauvegarde */
  private currentTrialStartedAt: string = "";

  /** Événement d'installation PWA capturé */
  private installPromptEvent: Event | null = null;

  constructor() {
    const root = document.getElementById("app");
    if (!root) throw new Error("Élément #app introuvable dans le DOM.");
    root.innerHTML = this.renderAppShell();

    const get = <T extends HTMLElement>(sel: string): T => {
      const el = root.querySelector<T>(sel);
      if (!el) throw new Error(`Élément ${sel} introuvable.`);
      return el;
    };

    this.mainEl = get(".app-main");
    this.headerTrialEl = get(".app-header__trial-id");
    this.headerPhaseEl = get(".app-header__phase");
    this.historyBtnEl = get<HTMLButtonElement>("#header-history-btn");
    this.saveIndicatorEl = get("#header-save-indicator");

    this.audio = new AudioManager();
    this.initPWA();
    this.bindHeaderEvents();

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
        <div class="app-header__trial" style="display:flex;align-items:center;gap:var(--s3)">
          <span id="header-save-indicator" class="save-indicator hidden"></span>
          <span class="app-header__phase" id="header-phase">Configuration</span>
          <span class="app-header__trial-id" id="header-trial">—</span>
          <button class="app-header__history-btn" id="header-history-btn"
                  title="Historique des essais">
            📂 Historique
          </button>
        </div>
      </header>
      <main class="app-main"></main>
    `;
  }

  // -------------------------------------------------------------------------
  // PWA — offline + installation
  // -------------------------------------------------------------------------

  private initPWA(): void {
    // Indicateur hors ligne dans le header
    const updateOnline = (): void => {
      const dot = document.querySelector(".header-offline-dot");
      if (!navigator.onLine) {
        if (!dot) {
          const d = document.createElement("span");
          d.className = "header-offline-dot";
          d.title = "Hors ligne — l'application fonctionne depuis le cache";
          this.historyBtnEl.before(d);
        }
      } else {
        dot?.remove();
      }
    };

    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    updateOnline(); // état initial

    // Capture du prompt d'installation PWA
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      this.installPromptEvent = e;
      this.showInstallPrompt();
    });
  }

  private showInstallPrompt(): void {
    // Eviter d'afficher deux fois
    if (document.getElementById("pwa-install-prompt")) return;

    const prompt = document.createElement("div");
    prompt.id = "pwa-install-prompt";
    prompt.className = "install-prompt";
    prompt.innerHTML = `
      <div class="install-prompt__title">🧪 Installer DissoloMaster Pro</div>
      <div class="install-prompt__body">
        Installez l'application sur votre bureau pour un accès hors ligne et des alertes optimales.
      </div>
      <div class="install-prompt__actions">
        <button class="btn btn--ghost btn--sm" id="pwa-dismiss">Plus tard</button>
        <button class="btn btn--primary btn--sm" id="pwa-install">Installer</button>
      </div>
    `;
    document.body.appendChild(prompt);

    document.getElementById("pwa-dismiss")?.addEventListener("click", () => prompt.remove());
    document.getElementById("pwa-install")?.addEventListener("click", async () => {
      if (!this.installPromptEvent) return;
      // @ts-expect-error — prompt() existe sur BeforeInstallPromptEvent
      await this.installPromptEvent.prompt();
      this.installPromptEvent = null;
      prompt.remove();
    });
  }

  // -------------------------------------------------------------------------
  // Header events
  // -------------------------------------------------------------------------

  private bindHeaderEvents(): void {
    this.historyBtnEl.addEventListener("click", () => this.showHistory());
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
      history: "Historique",
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
      this.showSetup();
      return;
    }

    const conflicts = detectConflicts(actions, config);
    const view = new PreviewView(
      config, actions, conflicts, this.audio,
      () => this.showRunning(config, actions),
      () => this.showSetup()
    );
    view.mount(this.mainEl);
    this.currentView = view;
  }

  private showRunning(config: TrialConfig, actions: TimelineAction[]): void {
    this.clearView();
    this.updateHeader("running", config.id);
    this.currentTrialStartedAt = new Date().toISOString();

    const view = new RunningView(
      config, actions, this.audio,
      (records) => this.showResults(config, records)
    );
    view.mount(this.mainEl);
    this.currentView = view;
  }

  private async showResults(config: TrialConfig, records: ActionEvent[]): Promise<void> {
    this.clearView();
    this.updateHeader("results", config.id);

    // --- Sauvegarde automatique ---
    void this.autoSave(config, records);

    const view = new ResultsView(
      config,
      records,
      () => this.showSetup(),
      () => this.showHistory()
    );
    view.mount(this.mainEl);
    this.currentView = view;
  }

  private showHistory(): void {
    this.clearView();
    this.updateHeader("history");

    const view = new HistoryView(
      (trial: StoredTrial) => this.showStoredTrial(trial),
      () => this.showSetup()
    );
    view.mount(this.mainEl);
    this.currentView = view;
  }

  private showStoredTrial(trial: StoredTrial): void {
    this.clearView();
    this.updateHeader("results", trial.config.id);

    // Mode lecture seule : onNewTrial = null, onHistory = retour historique
    const view = new ResultsView(
      trial.config,
      trial.records,
      null,
      () => this.showHistory()
    );
    view.mount(this.mainEl);
    this.currentView = view;
  }

  // -------------------------------------------------------------------------
  // Sauvegarde automatique
  // -------------------------------------------------------------------------

  private async autoSave(config: TrialConfig, records: ActionEvent[]): Promise<void> {
    try {
      await saveTrial(config, records, this.currentTrialStartedAt);
      this.flashSaveIndicator("✓ Sauvegardé");
    } catch (err) {
      if (err instanceof TrialStoreError) {
        console.warn("[App] Sauvegarde automatique échouée :", err.message);
        this.flashSaveIndicator("⚠ Non sauvegardé", true);
      }
    }
  }

  private flashSaveIndicator(msg: string, warn = false): void {
    this.saveIndicatorEl.textContent = msg;
    this.saveIndicatorEl.className = `save-indicator${warn ? "" : ""}`;
    this.saveIndicatorEl.style.color = warn
      ? "var(--warning-400)"
      : "var(--success-400)";
    // Forcer le re-déclenchement de l'animation CSS
    void this.saveIndicatorEl.offsetWidth;
    this.saveIndicatorEl.classList.remove("hidden");
    this.saveIndicatorEl.style.animation = "none";
    void this.saveIndicatorEl.offsetWidth;
    this.saveIndicatorEl.style.animation = "";
    setTimeout(() => this.saveIndicatorEl.classList.add("hidden"), 3000);
  }
}

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  new App();
});
