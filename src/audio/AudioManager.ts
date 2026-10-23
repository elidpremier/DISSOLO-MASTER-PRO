/**
 * audio/AudioManager.ts
 * Gestion des alertes sonores via Web Audio API.
 *
 * Les sons sont entièrement synthétisés (aucun fichier externe).
 * L'AudioContext est créé uniquement après une interaction utilisateur explicite
 * (obligation navigateur — section 4.5 du cahier des charges).
 *
 * Si le son est indisponible, isActive() retourne false et les appels aux
 * méthodes de lecture sont silencieusement ignorés — l'interface doit
 * alors activer l'alternative visuelle.
 */

export class AudioManager {
  private ctx: AudioContext | null = null;

  // -------------------------------------------------------------------------
  // Cycle de vie
  // -------------------------------------------------------------------------

  /**
   * Active le son après une interaction utilisateur explicite (clic).
   * Doit être appelé dans un handler d'événement pour respecter la politique
   * d'autoplay des navigateurs.
   * @returns true si l'activation a réussi.
   */
  activate(): boolean {
    try {
      this.ctx = new AudioContext();
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  /**
   * Libère l'AudioContext.
   */
  async deactivate(): Promise<void> {
    if (this.ctx) {
      await this.ctx.close();
      this.ctx = null;
    }
  }

  /**
   * Retourne true si le son est disponible et actif.
   */
  isActive(): boolean {
    return this.ctx !== null && this.ctx.state !== "closed";
  }

  // -------------------------------------------------------------------------
  // Alertes sonores
  // -------------------------------------------------------------------------

  /**
   * Pré-alerte : 3 bips courts (440 Hz, 80 ms, espacés de 200 ms).
   * Conforme à la section 4.5 : "À T−5 secondes, émettre trois bips courts."
   */
  playPreAlert(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.playTone(440, 0.08, t);
    this.playTone(440, 0.08, t + 0.2);
    this.playTone(440, 0.08, t + 0.4);
  }

  /**
   * Bip d'échéance : 1 bip long (880 Hz, 600 ms).
   * Conforme à la section 4.5 : "À l'échéance, émettre un bip long."
   */
  playDeadline(): void {
    if (!this.ctx) return;
    this.playTone(880, 0.6, this.ctx.currentTime);
  }

  /**
   * Séquence de test complète : pré-alerte + pause + bip d'échéance.
   * Doit être jouée avant le démarrage de l'essai (section 4.5).
   */
  playTest(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Pré-alerte
    this.playTone(440, 0.08, t);
    this.playTone(440, 0.08, t + 0.2);
    this.playTone(440, 0.08, t + 0.4);
    // Pause 400 ms, puis bip d'échéance
    this.playTone(880, 0.6, t + 0.85);
  }

  // -------------------------------------------------------------------------
  // Synthèse interne
  // -------------------------------------------------------------------------

  /**
   * Joue une tonalité pure avec enveloppe ADSR simple.
   * @param frequency  Fréquence en Hz.
   * @param durationSec Durée en secondes.
   * @param startTime  Heure de début (AudioContext.currentTime).
   */
  private playTone(
    frequency: number,
    durationSec: number,
    startTime: number
  ): void {
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = "sine";
    osc.frequency.value = frequency;

    // Enveloppe : attaque rapide (10 ms), soutien, relâchement rapide (10 ms)
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.35, startTime + 0.01);
    gain.gain.setValueAtTime(0.35, startTime + durationSec - 0.01);
    gain.gain.linearRampToValueAtTime(0, startTime + durationSec);

    osc.start(startTime);
    osc.stop(startTime + durationSec);
  }
}
