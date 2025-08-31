import { LitElement, html, css } from 'lit';
import { supabase } from '../lib/supabaseClient.js';

export class ApprovalsList extends LitElement {
  static properties = {
    familyId: { type: String },
    parentId: { type: String },
    chores: { state: true }
  };

  static styles = css`
    ul { list-style: none; padding: 0; margin: 0; display: grid; gap: .5rem; }
    li { border:1px solid #333; border-radius:.5rem; padding:.5rem; display:flex; align-items:center; justify-content:space-between; }
    .row { display:flex; gap:.5rem; }
    button { border:none; padding:.35rem .5rem; border-radius:.375rem; cursor:pointer; }
    .approve { background:#16a34a; color:white; }
    .reject { background:#b91c1c; color:white; }
  `;

  constructor() {
    super();
    this.chores = [];
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
      .from('chores')
      .select('id, title, type, status, due_date, assigned_to')
      .eq('family_id', this.familyId)
      .eq('status', 'done')
      .order('due_date', { ascending: true });
    this.chores = data || [];
  }

  subscribe() {
    this._ch = supabase.channel(`approvals-${this.familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chores', filter: `family_id=eq.${this.familyId}` }, () => this.load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approvals' }, () => this.load())
      .subscribe();
  }

  async approve(choreId) {
    // Insert approval row; trigger will update chore status and streaks
    await supabase.from('approvals').insert({ chore_id: choreId, approved_by: this.parentId, approved_at: new Date().toISOString() });
  }

  async reject(choreId) {
    await supabase.from('chores').update({ status: 'pending' }).eq('id', choreId);
  }

  render() {
    return html`
      <ul>
        ${this.chores.map(c => html`
          <li>
            <div>
              <div><strong>${c.title}</strong></div>
              <div class="meta">${c.type} • Due ${c.due_date}</div>
            </div>
            <div class="row">
              <button class="reject" @click=${() => this.reject(c.id)}>Reject</button>
              <button class="approve" @click=${() => this.approve(c.id)}>Approve</button>
            </div>
          </li>
        `)}
      </ul>
    `;
  }
}
customElements.define('approvals-list', ApprovalsList);