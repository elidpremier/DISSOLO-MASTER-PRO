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
import { ScientificDataView } from "./ui/ScientificDataView";
import { saveTrial, saveTrialCheckpoint, finalizeTrial, TrialStoreError } from "./db/TrialStore";
import type { TrialInterruption } from "./timer/Lifecycle";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AppPhase = "setup" | "preview" | "running" | "results" | "history" | "science";

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
  private currentTrialStorageId: string | null = null;
  private checkpointChain: Promise<void> = Promise.resolve();

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
          <button class="app-header__history-btn" id="header-install-btn"
                  title="Installer l'application sur cet appareil"
                  style="display:none">
            ⬇ Installer
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
    // --- Indicateur hors ligne ---
    const updateOnline = (): void => {
      const existing = document.querySelector(".header-offline-dot");
      if (!navigator.onLine) {
        if (!existing) {
          const dot = document.createElement("span");
          dot.className = "header-offline-dot";
          dot.title = "Hors ligne — l'application fonctionne depuis le cache";
          this.historyBtnEl.before(dot);
        }
      } else {
        existing?.remove();
      }
    };
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    updateOnline();

    // --- Bouton d'installation PWA ---
    const installBtn = document.getElementById("header-install-btn") as HTMLButtonElement | null;

    // Vérifier si l'app est déjà installée (mode standalone)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);

    if (isStandalone) {
      // Déjà installée : on masque le bouton, inutile
      if (installBtn) installBtn.style.display = "none";
    } else {
      // Afficher immédiatement un bouton "Installer" qui explique comment procéder
      // si beforeinstallprompt n'est pas encore disponible (ex. en dev)
      if (installBtn) {
        installBtn.style.display = "";
        installBtn.addEventListener("click", () => {
          if (this.installPromptEvent) {
            // Prompt natif disponible → le déclencher
            // @ts-expect-error — prompt() sur BeforeInstallPromptEvent
            void this.installPromptEvent.prompt();
            this.installPromptEvent = null;
            installBtn.textContent = "✓ Installation lancée";
            installBtn.disabled = true;
          } else {
            // Pas encore de prompt (dev ou navigateur non compatible) →
            // afficher une modale d'instructions
            this.showInstallInstructions();
          }
        });
      }
    }

    // Capturer le prompt quand le navigateur le propose (build + HTTPS/localhost)
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      this.installPromptEvent = e;
      // Mettre à jour le bouton pour signaler qu'il est prêt
      if (installBtn) {
        installBtn.style.display = "";
        installBtn.textContent = "⬇ Installer";
        installBtn.disabled = false;
        installBtn.style.color = "var(--blue-400)";
        installBtn.style.borderColor = "var(--blue-border)";
      }
    });

    // App installée : masquer le bouton
    window.addEventListener("appinstalled", () => {
      if (installBtn) installBtn.style.display = "none";
      this.installPromptEvent = null;
    });
  }

  private showInstallInstructions(): void {
    const existing = document.getElementById("pwa-install-instructions");
    if (existing) { existing.remove(); return; }

    const modal = document.createElement("div");
    modal.id = "pwa-install-instructions";
    modal.className = "install-prompt";
    const isSecure = window.isSecureContext;
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const contextWarning = !isSecure
      ? `<p class="form-error" style="display:block">⚠ Cette adresse n'est pas sécurisée (HTTPS). Une PWA ne peut généralement pas être installée depuis une adresse locale en <code>http://</code> sur un téléphone. Publiez-la sur un hébergement HTTPS ou ouvrez une URL HTTPS.</p>`
      : "";
    const instructions = isIos
      ? `<strong>iPhone / iPad (Safari) :</strong> ouvrez l'application dans Safari, touchez Partager, puis <em>Sur l'écran d'accueil</em>. Le navigateur n'affiche pas toujours un bouton Installer.`
      : isAndroid
        ? `<strong>Android (Chrome) :</strong> ouvrez l'URL HTTPS dans Chrome puis utilisez le menu ⋮ et <em>Installer l'application</em> ou <em>Ajouter à l'écran d'accueil</em>.`
        : `<strong>Android (Chrome) :</strong> utilisez le menu ⋮ puis <em>Installer l'application</em>. <strong>iPhone / iPad :</strong> utilisez Safari → Partager → <em>Sur l'écran d'accueil</em>.`;
    modal.innerHTML = `
      <div class="install-prompt__title">⬇ Installer DissoloMaster Pro</div>
      <div class="install-prompt__body">
        ${contextWarning}
        ${instructions}
        <br/><br/>
        <strong>Important :</strong> l'installation requiert une version de production servie en HTTPS. Le serveur de développement ou une adresse IP locale en HTTP fonctionne pour tester l'interface, mais pas de façon fiable pour installer sur un téléphone.
      </div>
      <div class="install-prompt__actions">
        <button class="btn btn--primary btn--sm" id="pwa-instr-close">Fermer</button>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById("pwa-instr-close")?.addEventListener("click", () => modal.remove());
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
      science: "Données scientifiques",
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
    this.currentTrialStorageId = null;
    this.checkpointChain = Promise.resolve();

    const view = new RunningView(
      config, actions, this.audio,
      (records) => this.showResults(config, records),
      (records, interruptions) => this.queueCheckpoint(config, records, interruptions),
    );
    view.mount(this.mainEl);
    this.currentView = view;
    this.queueCheckpoint(config, [], []);
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
      () => this.showHistory(),
      () => this.showScientificData(trial)
    );
    view.mount(this.mainEl);
    this.currentView = view;
  }

  private showScientificData(trial: StoredTrial): void {
    this.clearView();
    this.updateHeader("science", trial.config.id);
    const view = new ScientificDataView(trial, () => this.showStoredTrial(trial));
    view.mount(this.mainEl);
    this.currentView = view;
  }

  // -------------------------------------------------------------------------
  // Sauvegarde automatique
  // -------------------------------------------------------------------------

  private async autoSave(config: TrialConfig, records: ActionEvent[]): Promise<void> {
    try {
      await this.checkpointChain;
      if (this.currentTrialStorageId) {
        await finalizeTrial(this.currentTrialStorageId, records);
      } else {
        await saveTrial(config, records, this.currentTrialStartedAt);
      }
      this.flashSaveIndicator("✓ Sauvegardé");
    } catch (err) {
      if (err instanceof TrialStoreError) {
        console.warn("[App] Sauvegarde automatique échouée :", err.message);
        this.flashSaveIndicator("⚠ Non sauvegardé", true);
      }
    }
  }

  private queueCheckpoint(
    config: TrialConfig,
    records: ActionEvent[],
    interruptions: TrialInterruption[],
  ): void {
    this.checkpointChain = this.checkpointChain.then(async () => {
      try {
          this.currentTrialStorageId = await saveTrialCheckpoint(
            config,
            records,
            this.currentTrialStartedAt,
            interruptions,
            this.currentTrialStorageId ?? undefined,
          );
          this.flashSaveIndicator("✓ Sauvegarde");
      } catch (err) {
          if (err instanceof TrialStoreError) {
            console.warn("[App] Checkpoint échoué :", err.message);
            this.flashSaveIndicator("⚠ Non sauvegardé", true);
          }
      }
    });
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
