import { LitElement, html, css } from 'lit';
import { supabase } from '../lib/supabaseClient.js';

export class ChoreList extends LitElement {
  static properties = {
    familyId: { type: String },
    currentUserId: { type: String },
    isParent: { type: Boolean },
    chores: { state: true }
  };

  static styles = css`
    ul { list-style: none; padding: 0; margin: 0; display: grid; gap: .5rem; }
    li { border:1px solid #333; border-radius:.5rem; padding:.5rem; display:flex; align-items:center; justify-content:space-between; }
    .meta { opacity:.8; font-size:.9em; }
    button { background:#16a34a; border:none; color:white; padding:.35rem .5rem; border-radius:.375rem; cursor:pointer; }
  `;

  constructor() {
    super();
    this.chores = [];
    this._channel = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this.load();
    this.subscribe();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._channel) supabase.removeChannel(this._channel);
  }

  async load() {
    const query = supabase
      .from('chores')
      .select('id, title, type, status, due_date, assigned_to')
      .eq('family_id', this.familyId)
      .order('due_date', { ascending: true });
    if (!this.isParent) query.eq('assigned_to', this.currentUserId);
    const { data } = await query;
    this.chores = data || [];
  }

  subscribe() {
    if (!this.familyId) return;
    this._channel = supabase.channel(`chores-${this.familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chores', filter: `family_id=eq.${this.familyId}` }, () => this.load())
      .subscribe();
  }

  async markDone(id) {
    await supabase.from('chores').update({ status: 'done' }).eq('id', id).eq('assigned_to', this.currentUserId);
  }

  render() {
    return html`
      <ul>
        ${this.chores.map(c => html`
          <li>
            <div>
              <div><strong>${c.title}</strong> ${c.status !== 'pending' ? html`<small class="meta">(${c.status})</small>`: ''}</div>
              <div class="meta">${c.type} • Due ${c.due_date}</div>
            </div>
            ${!this.isParent && c.status === 'pending' ? html`<button @click=${() => this.markDone(c.id)}>Mark done</button>`: ''}
          </li>
        `)}
      </ul>
    `;
  }
}
customElements.define('chore-list', ChoreList);