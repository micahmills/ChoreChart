import { LitElement, html, css } from 'lit';
import { supabase } from '../lib/supabaseClient.js';

export class StreakTracker extends LitElement {
  static properties = {
    familyId: { type: String },
    streaks: { state: true }
  };

  static styles = css`
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: .5rem; border-bottom: 1px solid #333; }
  `;

  constructor() {
    super();
    this.streaks = [];
    this._ch = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this.load();
    this.subscribe();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._ch) supabase.removeChannel(this._ch);
  }

  async load() {
    const { data } = await supabase
      .from('streaks_view')
      .select('*')
      .eq('family_id', this.familyId)
      .order('name');
    this.streaks = data || [];
  }

  subscribe() {
    this._ch = supabase.channel(`streaks-${this.familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'streaks' }, () => this.load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approvals' }, () => this.load())
      .subscribe();
  }

  render() {
    return html`
      <table>
        <thead><tr><th>Member</th><th>Current</th><th>Longest</th></tr></thead>
        <tbody>
          ${this.streaks.map(s => html`<tr><td>${s.name}</td><td>${s.current_streak}</td><td>${s.longest_streak}</td></tr>`)}
        </tbody>
      </table>
    `;
  }
}
customElements.define('streak-tracker', StreakTracker);